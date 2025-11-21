import type { WSContext } from "hono/ws";
import PeerMatchingService from "./peer-matching/service";
import type {
  Duration,
  SessionWsMessage,
  SessionWsResponse,
} from "./validation";
import assert from "assert";
import {
  createSession,
  createSessionParticipant,
  getCompletedSessionsForCheckIn,
  updateSessionStatusToCheckIn,
  createCheckInReport,
  checkSessionDone,
  createSessionTask,
  toggleSessionTask,
  abortSession,
} from "db/tandem_sessions_sql";
import interval from "postgres-interval";
import { DBError } from "@/db/errors";
import Option, { Some, None } from "@/utils/monads/Option";
import { AlreadyHavePartner } from "./error";
import type AppError from "@/utils/error_handling/AppError";
import Result, { Ok } from "@/utils/monads/Result";
import moment from "moment";
import { withClient } from "@/db/helpers";

enum ConnStateId {
  MATCHING = "MATCHING",
  SESSION = "SESSION",
  CHECKIN = "CHECKIN",
}

class UserConn {
  public readonly user_id: string;
  private _ws: WSContext;
  private _state: ConnStateId;
  private session_metadata: Option<{
    session_id: string;
    partners_ids: string[];
  }> = None();

  constructor(user_id: string, ws: WSContext) {
    this.user_id = user_id;
    this._ws = ws;
    this._state = ConnStateId.MATCHING;
  }

  public handleMessage(msg: SessionWsResponse) {
    this._ws.send(JSON.stringify(msg));
  }

  public status(): ConnStateId {
    return this._state;
  }

  public updateState(to: ConnStateId): void {
    this._state = to;
  }

  public close() {
    this._ws.close();
  }

  public pair(
    session_id: string,
    partners_ids: string[],
  ): Option<AlreadyHavePartner> {
    return this.session_metadata.match({
      ifSome: () => Some(new AlreadyHavePartner()),
      ifNone: () => {
        this.session_metadata = Some({
          partners_ids,
          session_id,
        });
        this.updateState(ConnStateId.SESSION);
        return None();
      },
    });
  }

  public getPartnersId(): Option<string[]> {
    return this.session_metadata.map(({ partners_ids }) => partners_ids);
  }

  public removePartner(partner_id: string) {
    this.session_metadata = this.session_metadata.map((metadata) => ({
      ...metadata,
      partners_ids: metadata.partners_ids.filter((id) => id !== partner_id),
    }));
  }
  public getPartnerCount() {
    return this.session_metadata.match({
      ifSome: (x) => x.partners_ids.length,
      ifNone: () => 0,
    });
  }

  public getSessionId(): Option<string> {
    return this.session_metadata.map(({ session_id }) => session_id);
  }
}

abstract class ConnectionState {
  protected context: {
    conn: UserConn;
    registry: ConnectionRegistry;
    manager: ConnectionManager;
  };
  public abstract readonly id: ConnStateId;
  constructor(
    conn: UserConn,
    registry: ConnectionRegistry,
    manager: ConnectionManager,
  ) {
    this.context = { conn, registry, manager };
  }
  public abstract handleMessage(
    msg: SessionWsMessage,
  ): Promise<Option<AppError>>;

  public abstract handleClose(): Promise<Result<boolean, AppError>>;
}

class MatchingState extends ConnectionState {
  public readonly id = ConnStateId.MATCHING;

  public async handleMessage(msg: SessionWsMessage): Promise<Option<AppError>> {
    if (msg.type !== "init_session") return None();

    const conn = this.context.conn;
    conn.updateState(ConnStateId.MATCHING);

    const matched_user = this.context.manager.peer_matching.match({
      user_id: conn.user_id,
      duration: msg.focus_duration,
      tasks: msg.tasks,
    });

    return matched_user.match({
      ifNone: async () => {
        conn.handleMessage({ type: "matching_pending" });
        return None();
      },
      ifSome: async (client) => {
        const other_conn_op = this.context.registry.get(client.user_id);
        assert(other_conn_op.isSome());
        const other_conn = other_conn_op.unwrap();

        const db_result = await this.initSession(
          conn,
          msg.tasks,
          other_conn,
          client.tasks,
          client.duration,
        );

        return db_result.match({
          ifOk: () => None(),
          ifErr: (err) => Some(err),
        });
      },
    });
  }

  private async initSession(
    conn1: UserConn,
    tasks1: string[],
    conn2: UserConn,
    tasks2: string[],
    session_duration: Duration,
  ): Promise<Result<void, DBError>> {
    return withClient(async (client) => {
      const session = await createSession(client, {
        scheduledDuration: interval(session_duration),
      });
      if (!session) throw new DBError("Failed creating a session");

      // TODO: Handle the removal of users (in case it happens in dev or prod?)
      const [, , tasks1_res, tasks2_res] = await Promise.all([
        createSessionParticipant(client, {
          sessionId: session.sessionId,
          userId: conn1.user_id,
        }),
        createSessionParticipant(client, {
          sessionId: session.sessionId,
          userId: conn2.user_id,
        }),
        Promise.all(
          tasks1.map((task) =>
            createSessionTask(client, {
              sessionId: session.sessionId,
              userId: conn1.user_id,
              title: task,
            }),
          ),
        ),
        Promise.all(
          tasks2.map((task) =>
            createSessionTask(client, {
              sessionId: session.sessionId,
              userId: conn2.user_id,
              title: task,
            }),
          ),
        ),
      ]);

      conn1.pair(session.sessionId, [conn2.user_id]);
      conn2.pair(session.sessionId, [conn1.user_id]);

      const start_time = moment().toISOString();
      const scheduled_end_time = moment(start_time)
        .add(moment.duration(session_duration))
        .toISOString();
      conn1.handleMessage({
        type: "matched",
        partner_id: conn2.user_id,
        partner_tasks: tasks2,
        tasks: tasks1_res
          .filter((task) => !!task)
          .map((x) => ({
            title: x!.title,
            task_id: x!.taskId,
          })),
        start_time,
        scheduled_end_time,
      });

      conn2.handleMessage({
        type: "matched",
        partner_id: conn1.user_id,
        partner_tasks: tasks1,
        tasks: tasks2_res
          .filter((task) => !!task)
          .map((x) => ({
            title: x!.title,
            task_id: x!.taskId,
          })),
        start_time,
        scheduled_end_time,
      });
    });
  }

  public override async handleClose(): Promise<Result<boolean, AppError>> {
    this.context.manager.peer_matching.disconnectClient(
      this.context.conn.user_id,
    );
    return Ok(true);
  }
}

class SessionState extends ConnectionState {
  public override id: ConnStateId = ConnStateId.SESSION;

  public override async handleMessage(
    msg: SessionWsMessage,
  ): Promise<Option<AppError>> {
    if (msg.type == "toggle_task") {
      const db_result = await withClient(async (client) => {
        await toggleSessionTask(client, {
          taskId: msg.task_id,
          userId: this.context.conn.user_id,
          isComplete: msg.is_complete ? "true" : "false",
        });
      });

      return db_result.match({
        ifOk: () => None(),
        ifErr: (err) => {
          console.error(err);
          return Some(err);
        },
      });
    }
    return None();
  }

  public override async handleClose(): Promise<Result<boolean, AppError>> {
    const partner = this.context.conn.getPartnersId();
    partner.tap(async (partners) => {
      for (const p of partners) {
        const partner_conn = this.context.registry.get(p).unwrap();
        partner_conn.handleMessage({ type: "other_used_disconnected" });
        partner_conn.removePartner(this.context.conn.user_id);

        if (partner_conn.getPartnerCount() === 0) {
          await this.removeSession();
          this.context.registry.delete(p);
        }
      }
    });

    this.context.registry.delete(this.context.conn.user_id);
    return Ok(false);
  }

  private async removeSession() {
    this.context.conn.getSessionId().tap(async (session_id) => {
      const db_result = await withClient(async (client) => {
        await abortSession(client, {
          sessionId: [session_id],
        });
      });

      if (db_result.isErr()) {
        console.error("Failed to abort session:", db_result.unwrapErr());
      }
    });
  }
}

class CheckInState extends ConnectionState {
  public override id: ConnStateId = ConnStateId.CHECKIN;

  public override async handleMessage(
    msg: SessionWsMessage,
  ): Promise<Option<AppError>> {
    if (msg.type === "checkin_report") {
      const db_result = await withClient(async (client) => {
        const conn = this.context.conn;
        const user_id = conn.user_id;
        const session_id = conn.getSessionId().unwrap();
        const partner_conn = this.context.registry
          .get(msg.reviewee_id)
          .unwrap();

        await createCheckInReport(client, {
          sessionId: session_id,
          revieweeId: msg.reviewee_id,
          reviewerId: user_id,
          workProved: msg.work_proved ? "true" : "false",
        });

        partner_conn.handleMessage({
          type: "checkin_report_sent",
          work_proved: msg.work_proved,
        });

        // NOTE: This method will need to change later for private sessions, where we can have more than one user
        const result = await checkSessionDone(client, {
          sessionId: session_id,
        });

        if (!result) throw new DBError();

        if (result.done) {
          // Terminate session
          const other_conn = this.context.registry
            .get(msg.reviewee_id)
            .unwrap();

          await Promise.all(
            [conn, other_conn].map((c) => {
              c.handleMessage({
                type: "session_done",
              });
              this.context.registry.delete(c.user_id);
            }),
          );
        }
      });
      return db_result.isErr() ? Some(db_result.unwrapErr()) : None();
    } else if (msg.type == "checkin_message") {
      // TODO: create a checkin message in database (create the schema for it)
      const conn = this.context.conn;
      const partners = conn.getPartnersId();
      partners.tap((ps) => {
        for (const p of ps) {
          const partner_conn = this.context.registry.get(p).unwrap();
          partner_conn.handleMessage({
            type: "checkin_partner_message",
            content: msg.content,
          });
        }
      });
    }
    return None();
  }
  public override async handleClose(): Promise<Result<boolean, AppError>> {
    return Ok(true);
  }
}

class StateFactory {
  static build(
    id: ConnStateId,
    conn: UserConn,
    reg: ConnectionRegistry,
    m: ConnectionManager,
  ): ConnectionState {
    console.log(`Building state ${id} for user_id=${conn.user_id}`);
    if (id === ConnStateId.MATCHING) return new MatchingState(conn, reg, m);
    if (id === ConnStateId.SESSION) return new SessionState(conn, reg, m);
    if (id === ConnStateId.CHECKIN) return new CheckInState(conn, reg, m);
    throw new Error("unimplemented state");
  }
}

class ConnectionRegistry {
  private conns: Map<string, UserConn> = new Map();

  public add(conn: UserConn): void {
    const user_id = conn.user_id;
    if (this.conns.has(user_id)) {
      const old_conn = this.conns.get(user_id)!;
      old_conn.handleMessage({
        type: "terminated",
        reason: "Joined from another browser",
      });
      old_conn.close();
    }
    this.conns.set(user_id, conn);
  }

  public get(user_id: string): Option<UserConn> {
    return Option.fromNullable(() => this.conns.get(user_id));
  }

  public delete(user_id: string): boolean {
    const exists = this.conns.get(user_id);
    if (!exists) return false;
    exists.close();
    return this.conns.delete(user_id);
  }
}

export class ConnectionManager {
  private static _instance: ConnectionManager | null = null;
  public peer_matching: PeerMatchingService;
  private registry: ConnectionRegistry;

  constructor() {
    this.peer_matching = PeerMatchingService.instance();
    this.registry = new ConnectionRegistry();
  }

  static instance(): ConnectionManager {
    if (!this._instance) {
      this._instance = new ConnectionManager();
      console.log("iniialized?");
      this._instance.checkCompletedSessions();
    }
    return this._instance;
  }

  public initConn(ws: WSContext, user_id: string) {
    this.registry.add(new UserConn(user_id, ws));
  }

  public async handleMessage(
    user_id: string,
    msg: SessionWsMessage,
  ): Promise<Option<DBError>> {
    const conn_op = this.registry.get(user_id);
    if (conn_op.isNone()) return None();
    const conn = conn_op.unwrap();

    const state = StateFactory.build(conn.status(), conn, this.registry, this);
    return await state.handleMessage(msg);
  }

  public async handleClose(user_id: string): Promise<Option<AppError>> {
    const conn_op = this.registry.get(user_id);
    if (conn_op.isNone()) return None();
    const conn = conn_op.unwrap();

    const state = StateFactory.build(conn.status(), conn, this.registry, this);
    const result = await state.handleClose();
    return result.match({
      ifOk: (to_remove) => {
        if (to_remove) this.registry.delete(conn.user_id);
        return None();
      },
      ifErr: (err) => Some(err),
    });
  }

  // I believe it's fine to use polling here, given it's almost the case there will be many sessions done at the same time, if many users use this of course
  private async checkCompletedSessions() {
    console.log("starting checking completed sessions");
    while (true) {
      const db_result = await withClient(async (client) => {
        const sessions = await getCompletedSessionsForCheckIn(client);
        const now = moment();
        const CHECK_IN_MINUTES = 2;
        console.log(sessions.map((x) => x.sessionId));

        if (sessions.length !== 0) {
          sessions.forEach((x) => {
            const conn_op = this.registry.get(x.userId);
            if (conn_op.isNone()) return false;
            const conn = conn_op.unwrap();
            conn.updateState(ConnStateId.CHECKIN);
            conn.handleMessage({
              type: "checkin_start",
              start_time: now.toISOString(),
              scheduled_end_time: now
                .clone()
                .add(CHECK_IN_MINUTES)
                .toISOString(),
            });
          });
          await updateSessionStatusToCheckIn(client, {
            sessionId: sessions.map((x) => x.sessionId),
          });
        }
      });

      if (db_result.isErr()) {
        console.error("Error checking sessions:", db_result.unwrapErr());
      }

      // wait 0.5 second before next iteration
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}
