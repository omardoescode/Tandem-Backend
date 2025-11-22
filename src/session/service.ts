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
import pool from "@/db/pool";
import type { PoolClient as Client } from "pg";
import interval from "postgres-interval";
import { DBError } from "@/db/errors";
import { AlreadyHavePartner } from "./error";
import AppError from "@/utils/error_handling/AppError";
import moment from "moment";

enum ConnStateId {
  MATCHING = "MATCHING",
  SESSION = "SESSION",
  CHECKIN = "CHECKIN",
}

class UserConn {
  public readonly user_id: string;
  private _ws: WSContext;
  private _state: ConnStateId;
  private session_metadata: {
    session_id: string;
    partners_ids: string[];
  } | null = null;

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
  ): AlreadyHavePartner | null {
    if (this.session_metadata) {
      return new AlreadyHavePartner();
    } else {
      this.session_metadata = {
        partners_ids,
        session_id,
      };
      this.updateState(ConnStateId.SESSION);
      return null;
    }
  }

  public getPartnersId(): string[] | null {
    return this.session_metadata ? this.session_metadata.partners_ids : null;
  }

  public removePartner(partner_id: string) {
    if (this.session_metadata) {
      this.session_metadata = {
        ...this.session_metadata,
        partners_ids: this.session_metadata.partners_ids.filter(
          (id) => id !== partner_id,
        ),
      };
    }
  }

  public getPartnerCount(): number {
    return this.session_metadata
      ? this.session_metadata.partners_ids.length
      : 0;
  }

  public getSessionId(): string | null {
    return this.session_metadata ? this.session_metadata.session_id : null;
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
  ): Promise<AppError | null>;

  public abstract handleClose(): Promise<boolean | AppError>;
}

class MatchingState extends ConnectionState {
  public readonly id = ConnStateId.MATCHING;

  public async handleMessage(msg: SessionWsMessage): Promise<AppError | null> {
    if (msg.type !== "init_session") return null;

    const conn = this.context.conn;
    conn.updateState(ConnStateId.MATCHING);

    // PeerMatchingService.match is assumed to return MatchedUser | null
    const matched_user = this.context.manager.peer_matching.match({
      user_id: conn.user_id,
      duration: msg.focus_duration,
      tasks: msg.tasks,
    });

    if (!matched_user) {
      conn.handleMessage({ type: "matching_pending" });
      return null;
    } else {
      const other_conn = this.context.registry.get(matched_user.user_id);
      assert(other_conn !== null); // Assumes get returns UserConn | null

      const db_result = await this.initSession(
        conn,
        msg.tasks,
        other_conn!,
        matched_user.tasks,
        matched_user.duration,
      );

      if (db_result instanceof AppError) {
        return db_result;
      }

      return null;
    }
  }

  // Changed to return void | DBError
  private async initSession(
    conn1: UserConn,
    tasks1: string[],
    conn2: UserConn,
    tasks2: string[],
    session_duration: Duration,
  ): Promise<void | DBError> {
    let client: Client | null = null;
    try {
      client = await pool.connect();

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
      await client.query("commit");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      if (client) await client.query("rollback");
      return err instanceof DBError
        ? err
        : new DBError("Session creation failed", { reason: err });
    } finally {
      if (client) client.release();
    }
  }

  public override async handleClose(): Promise<boolean | AppError> {
    this.context.manager.peer_matching.disconnectClient(
      this.context.conn.user_id,
    );
    return true;
  }
}

class SessionState extends ConnectionState {
  public override id: ConnStateId = ConnStateId.SESSION;

  public override async handleMessage(
    msg: SessionWsMessage,
  ): Promise<AppError | null> {
    if (msg.type == "toggle_task") {
      let client: Client | null = null;
      try {
        client = await pool.connect();
        await toggleSessionTask(client, {
          taskId: msg.task_id,
          userId: this.context.conn.user_id,
          isComplete: msg.is_complete ? "true" : "false",
        });
        await client.query("commit");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        if (client) await client.query("rollback");
        console.error(err);
        return err instanceof DBError
          ? err
          : new DBError("Toggle task failed", { reason: err });
      } finally {
        if (client) client.release();
      }
    }
    return null;
  }

  public override async handleClose(): Promise<boolean | AppError> {
    const partners = this.context.conn.getPartnersId(); // string[] | null
    if (partners) {
      for (const p of partners) {
        const partner_conn = this.context.registry.get(p); // UserConn | null
        if (partner_conn) {
          partner_conn.handleMessage({ type: "other_used_disconnected" });
          partner_conn.removePartner(this.context.conn.user_id);

          if (partner_conn.getPartnerCount() === 0) {
            await this.removeSession();
            this.context.registry.delete(p);
          }
        }
      }
    }

    this.context.registry.delete(this.context.conn.user_id);
    return false;
  }

  private async removeSession() {
    const session_id = this.context.conn.getSessionId(); // string | null
    if (session_id) {
      let client: Client | null = null;
      try {
        client = await pool.connect();
        await abortSession(client, {
          sessionId: [session_id],
        });
        await client.query("commit");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        if (client) await client.query("rollback");
        console.error("Failed to abort session:", err);
      } finally {
        if (client) client.release();
      }
    }
  }
}

class CheckInState extends ConnectionState {
  public override id: ConnStateId = ConnStateId.CHECKIN;

  public override async handleMessage(
    msg: SessionWsMessage,
  ): Promise<AppError | null> {
    if (msg.type === "checkin_report") {
      let client: Client | null = null;
      try {
        client = await pool.connect();
        const conn = this.context.conn;
        const user_id = conn.user_id;
        const session_id = conn.getSessionId(); // string | null
        if (!session_id) throw new DBError("Session ID missing for checkin");

        const partner_conn = this.context.registry.get(msg.reviewee_id); // UserConn | null
        if (!partner_conn) throw new Error("Partner connection missing");

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

        if (!result) throw new DBError("Failed to check session done status");

        if (result.done) {
          // Terminate session
          const other_conn = this.context.registry.get(msg.reviewee_id);
          assert(other_conn !== null);

          await Promise.all(
            [conn, other_conn].map((c) => {
              c.handleMessage({
                type: "session_done",
              });
              this.context.registry.delete(c.user_id);
            }),
          );
        }
        await client.query("commit");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        if (client) await client.query("rollback");
        return err instanceof AppError
          ? err
          : new DBError("Check-in report failed", { reason: err });
      } finally {
        if (client) client.release();
      }
    } else if (msg.type == "checkin_message") {
      // TODO: create a checkin message in database (create the schema for it)
      const conn = this.context.conn;
      const partners = conn.getPartnersId(); // string[] | null
      if (partners) {
        for (const p of partners) {
          const partner_conn = this.context.registry.get(p); // UserConn | null
          if (partner_conn) {
            partner_conn.handleMessage({
              type: "checkin_partner_message",
              content: msg.content,
            });
          }
        }
      }
    }
    return null;
  }

  public override async handleClose(): Promise<boolean | AppError> {
    return true;
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

  public get(user_id: string): UserConn | null {
    return this.conns.get(user_id) || null;
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
  ): Promise<DBError | null> {
    const conn = this.registry.get(user_id);
    if (!conn) return null;

    const state = StateFactory.build(conn.status(), conn, this.registry, this);
    const result = await state.handleMessage(msg); // AppError | null

    // Convert AppError | null to DBError | null (assuming we only propagate DBError here)
    if (result instanceof DBError) return result;
    if (result instanceof AppError)
      return new DBError(result.message, { reason: result });
    return null;
  }

  public async handleClose(user_id: string): Promise<AppError | null> {
    const conn = this.registry.get(user_id); // UserConn | null
    if (!conn) return null;

    const state = StateFactory.build(conn.status(), conn, this.registry, this);
    const result = await state.handleClose(); // boolean | AppError

    if (result instanceof AppError) {
      return result;
    }

    // Success case: result is boolean
    if (result) this.registry.delete(conn.user_id);
    return null;
  }

  // I believe it's fine to use polling here, given it's almost the case there will be many sessions done at the same time, if many users use this of course
  private async checkCompletedSessions() {
    while (true) {
      let client: Client | null = null;
      try {
        client = await pool.connect();
        const sessions = await getCompletedSessionsForCheckIn(client);
        const now = moment();
        const CHECK_IN_MINUTES = 2;

        if (sessions.length !== 0) {
          sessions.forEach((x) => {
            console.log(
              "Sessions moving to checkin: ",
              sessions.map((x) => x.sessionId),
            );
            const conn = this.registry.get(x.userId); // UserConn | null
            if (!conn) return false;

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
          await client.query("commit");
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        if (client) await client.query("rollback");
        console.error("Error checking sessions:", err);
      } finally {
        if (client) client.release();
      }

      // wait 1 second before next iteration
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}
