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
import type Option from "@/utils/monads/Option";
import { None, Some } from "@/utils/monads/Option";

export interface UserConn {
  ws: WSContext;
  user_id: string;
  status: "start" | "peer-matching" | "session" | "checkin";
  tasks: string[];
}

export class ConnectionManager {
  private static _instance: ConnectionManager | null = null;
  private peer_matching: PeerMatchingService;
  private conns: Map<string, UserConn> = new Map();

  constructor() {
    this.peer_matching = PeerMatchingService.instance();
  }
  static instance(): ConnectionManager {
    if (!this._instance) {
      this._instance = new ConnectionManager();
    }
    return this._instance;
  }

  public initConn(ws: WSContext, user_id: string) {
    if (this.conns.has(user_id)) {
      const old_ws = this.conns.get(user_id)!.ws;
      old_ws.send(
        JSON.stringify({
          type: "terminated",
          reason: "You have joined from another browser",
        }),
      );
      old_ws.close();
      this.conns.delete(user_id);
    }

    this.conns.set(user_id, {
      ws,
      user_id,
      status: "start",
      tasks: [],
    });
  }

  public async handleMessage(
    user_id: string,
    msg: SessionWsMessage,
  ): Promise<Option<DBError>> {
    if (msg.type === "init_session") {
      const conn = this.conns.get(user_id);
      assert(!!conn);

      if (conn.status !== "start") {
        conn.ws.send(
          JSON.stringify({
            type: "error",
            error: `Invalid state transition. Current status is ${conn.status}`,
          }),
        );
        return None();
      }
      conn.status = "peer-matching";

      conn.tasks = msg.tasks;

      const other = this.peer_matching.match({
        user_id,
        timer_seconds: msg.focus_duration_seconds,
      });

      if (!other) {
        conn.ws.send(
          JSON.stringify({
            type: "matching_pending",
          } as SessionWsResponse),
        );
        return None();
      }

      const other_conn = this.conns.get(other.user_id);
      assert(!!other_conn);

      const res = await this.initSession(conn, other_conn, other.timer_seconds);
      if (res.isSome()) return res;
    }
    throw new Error("didn't write code for other cases");
  }

  private async initSession(
    conn1: UserConn,
    conn2: UserConn,
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

    conn1.ws.send(
      JSON.stringify({
        type: "matched",
        partner_id: conn2.user_id,
        partner_tasks: conn2.tasks,
      } as SessionWsResponse),
    );
    conn2.ws.send(
      JSON.stringify({
        type: "matched",
        partner_id: conn1.user_id,
        partner_tasks: conn1.tasks,
      } as SessionWsResponse),
    );

    return None();
  }
}
