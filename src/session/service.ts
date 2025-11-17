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
import Option from "@/utils/monads/Option";
import { None, Some } from "@/utils/monads/Option";
import type { ConnectionState } from "./types";

class UserConn {
  public readonly user_id: string;
  private _ws: WSContext;
  private _status: ConnectionState;

  constructor(user_id: string, ws: WSContext) {
    this.user_id = user_id;
    this._ws = ws;
    this._status = "start";
  }

  public handleMessage(msg: SessionWsResponse) {
    this._ws.send(JSON.stringify(msg));
  }

  public status(): ConnectionState {
    return this._status;
  }

  // TODO: Find a better way
  public updateStatus(to: ConnectionState): boolean {
    if (to === "peer-matching" && this._status !== "start") return false;
    this._status = to;
    return true;
  }

  public close() {
    this._ws.close();
  }
}

class ConnectionRegistry {
  private conns: Map<string, UserConn> = new Map();
  public add(conn: UserConn): void {
    const user_id = conn.user_id;
    if (this.conns.has(user_id)) {
      // Gracefully terminate old connection
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
  private peer_matching: PeerMatchingService;
  private registry: ConnectionRegistry;

  constructor() {
    this.peer_matching = PeerMatchingService.instance();
    this.registry = new ConnectionRegistry();
  }
  static instance(): ConnectionManager {
    if (!this._instance) {
      this._instance = new ConnectionManager();
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
    if (msg.type === "init_session") {
      const conn_op = this.registry.get(user_id);
      assert(conn_op.isSome());
      const conn = conn_op.unwrap();

      if (conn.status() !== "start") {
        conn.handleMessage({
          type: "error",
          error: `Invalid state transition. Current status is ${conn.status}`,
        });
        return None();
      }
      conn.updateStatus("peer-matching");

      const other = this.peer_matching.match({
        user_id,
        timer_seconds: msg.focus_duration_seconds,
        tasks: msg.tasks,
      });

      if (!other) {
        conn.ws.send(
          JSON.stringify({
            type: "matching_pending",
          } as SessionWsResponse),
        );
        return None();
      }

      const other_conn = this.registry.get(other.user_id);
      assert(other_conn.isSome());

      const res = await this.initSession(
        conn,
        msg.tasks,
        other_conn.unwrap(),
        other.tasks,
        other.timer_seconds,
      );
      if (res.isSome()) return res;
    }
    throw new Error("didn't write code for other cases");
  }

  private async initSession(
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
}
