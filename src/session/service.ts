import type { WSContext } from "hono/ws";
import PeerMatchingService from "./peer-matching/service";
import type { SessionWsMessage, SessionWsResponse } from "./validation";
import assert from "assert";
import {
  createSession,
  createSessionParticipant,
} from "db/tandem_sessions_sql";
import pool from "@/db/pool";
import interval from "postgres-interval";
import { DBError } from "@/db/errors";
import Option, { Some, None } from "@/utils/monads/Option";
import { AlreadyHavePartner } from "./error";
import type AppError from "@/utils/error_handling/AppError";

enum ConnStateId {
  START,
  MATCHING,
  SESSION,
  CHECKIN,
}

class UserConn {
  public readonly user_id: string;
  private _ws: WSContext;
  private _state: ConnStateId;
  private partner_id: Option<string> = None();

  constructor(user_id: string, ws: WSContext) {
    this.user_id = user_id;
    this._ws = ws;
    this._state = ConnStateId.START;
  }

  public handleMessage(msg: SessionWsResponse) {
    this._ws.send(JSON.stringify(msg));
  }

  public status(): ConnStateId {
    return this._state;
  }

  public updateState(to: ConnStateId): boolean {
    if (to === ConnStateId.MATCHING && this._state !== ConnStateId.START)
      return false;
    this._state = to;
    return true;
  }

  public close() {
    this._ws.close();
  }

  public pair(partner_id: string): Option<AlreadyHavePartner> {
    if (this.partner_id.isSome()) return Some(new AlreadyHavePartner());
    this.partner_id = Some(partner_id);
    return None();
  }

  public getPartnerId(): Option<string> {
    return this.partner_id;
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

  public abstract handleClose(): Promise<Option<AppError>>;
}

class StartState extends ConnectionState {
  public readonly id = ConnStateId.START;

  public async handleMessage(msg: SessionWsMessage): Promise<Option<AppError>> {
    if (msg.type !== "init_session") return None();

    const conn = this.context.conn;
    if (!conn.updateState(ConnStateId.MATCHING)) return None();

    const match = this.context.manager.peer_matching.match({
      user_id: conn.user_id,
      timer_seconds: msg.focus_duration_seconds,
      tasks: msg.tasks,
    });

    if (!match) {
      conn.handleMessage({ type: "matching_pending" });
      return None();
    }

    const other_conn_op = this.context.registry.get(match.user_id);
    assert(other_conn_op.isSome());
    const other_conn = other_conn_op.unwrap();

    return await this.initSession(
      conn,
      msg.tasks,
      other_conn,
      match.tasks,
      match.timer_seconds,
    );
  }

  public async initSession(
    conn1: UserConn,
    tasks1: string[],
    conn2: UserConn,
    tasks2: string[],
    scheduled_durations_seconds: number,
  ): Promise<Option<DBError>> {
    const client = await pool.connect();
    try {
      const session = await createSession(client, {
        scheduledDuration: interval(`${scheduled_durations_seconds} seconds`),
      });
      if (!session) return Some(new DBError("Failed creating a session"));

      await Promise.all([
        createSessionParticipant(client, {
          sessionId: session.sessionId,
          userId: conn1.user_id,
        }),
        createSessionParticipant(client, {
          sessionId: session.sessionId,
          userId: conn2.user_id,
        }),
      ]);

      client.query("commit");
    } finally {
      client.release();
    }

    conn1.pair(conn2.user_id);
    conn2.pair(conn1.user_id);

    conn1.handleMessage({
      type: "matched",
      partner_id: conn2.user_id,
      partner_tasks: tasks2,
    });

    conn2.handleMessage({
      type: "matched",
      partner_id: conn1.user_id,
      partner_tasks: tasks1,
    });

    return None();
  }

  public override async handleClose(): Promise<Option<AppError>> {
    const partner = this.context.conn.getPartnerId();
    if (partner.isSome()) {
      const p = this.context.registry.get(partner.unwrap());
      if (p.isSome())
        p.unwrap().handleMessage({ type: "other_used_disconnected" });
    }

    this.context.registry.delete(this.context.conn.user_id);
    return None();
  }
}

class StateFactory {
  static build(
    id: ConnStateId,
    conn: UserConn,
    reg: ConnectionRegistry,
    m: ConnectionManager,
  ): ConnectionState {
    if (id === ConnStateId.START) return new StartState(conn, reg, m);
    // if (id === ConnStateId.MATCHING) return new MatchingState(conn, reg, m);
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
    if (!this._instance) this._instance = new ConnectionManager();
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

  public async handleClose(user_id: string) {
    const conn_op = this.registry.get(user_id);
    if (conn_op.isNone()) return None();
    const conn = conn_op.unwrap();

    const state = StateFactory.build(conn.status(), conn, this.registry, this);
    return await state.handleClose();
  }
}
