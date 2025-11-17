import type { WSContext } from "hono/ws";
import PeerMatchingService from "./peer-matching/service";
import type { SessionWsMessage, SessionWsResponse } from "./validation";
import assert from "assert";

export interface UserConn {
  ws: WSContext;
  user_id: string;
  status: "start" | "peer-matching" | "session" | "checkin";
  tasks: string[];
}

export class ConnectionManager {
  private static _instance: ConnectionManager | null = null;
  private peerMatchingService: PeerMatchingService;
  private conns: Map<string, UserConn> = new Map();

  constructor() {
    this.peerMatchingService = PeerMatchingService.instance();
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
          reason: "You have joined from another connection",
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
  ): Promise<SessionWsResponse> {
    if (msg.type === "init_session") {
      const conn = this.conns.get(user_id);
      assert(!!conn);

      if (conn.status !== "start")
        return {
          type: "error",
          error: `Invalid state transition. Current status is ${conn.status}`,
        };
      conn.status = "peer-matching";

      conn.tasks = msg.tasks;

      const other = this.peerMatchingService.match({
        user_id,
        timer_seconds: msg.focus_duration_seconds,
      });

      if (!other)
        return {
          type: "matching_pending",
        };

      const other_conn = this.conns.get(other.user_id);
      assert(!!other_conn);
      other_conn.ws.send(
        JSON.stringify({
          type: "partner_found",
          partner_id: conn.user_id,
          partner_tasks: conn.tasks,
        }),
      );
      return {
        type: "matched",
        partner_id: other_conn.user_id,
        partner_tasks: other_conn.tasks,
      };
    }
    throw new Error("didn't write code for other cases");
  }
}
