import type { WSContext } from "hono/ws";
import type { SessionWsResponse } from "../validation";
import { SessionService } from "./SessionService";
import { SessionCacheRegistry } from "./SessionCacheRegistry";

const socket_registry = new Map<string, Map<string, WSContext>>();

export const WebSocketRegistry = {
  addSocket: async (
    userId: string,
    ws_id: string,
    ws: WSContext,
  ): Promise<void> => {
    let existing = socket_registry.get(userId);

    if (existing) {
      existing.set(ws_id, ws);
    } else {
      existing = new Map();
      existing.set(ws_id, ws);
    }
    socket_registry.set(userId, existing);
  },

  /**
   * Handle the removal of a participant
   * @returns true if the user has been disconnected entirely
   */
  disconnectSocket: async (userId: string, ws_id: string): Promise<boolean> => {
    const sockets = socket_registry.get(userId);
    if (!sockets) return false;
    sockets.delete(ws_id);
    if (sockets.size == 0) {
      SessionService.handleDisconnect(userId);
      socket_registry.delete(userId);
      return true;
    }
    return false;
  },

  endUserConnection: async (userId: string) => {
    const sockets = socket_registry.get(userId);
    if (!sockets) return;

    sockets.values().forEach((ws) => ws.close());
    socket_registry.delete(userId);
  },

  broadcast: async (
    userId: string,
    message: SessionWsResponse,
  ): Promise<boolean> => {
    const sockets = socket_registry.get(userId);
    if (!sockets) return false;

    const stringified = JSON.stringify(message);
    sockets.values().forEach((ws) => ws.send(stringified));
    return true;
  },
  broadcastToSession: async (sessionId: string, message: SessionWsResponse) => {
    const session = SessionCacheRegistry.getSession(sessionId);
    if (!session) {
      return;
    }

    const stringified_message = JSON.stringify(message);
    session.participants
      .filter((p) => p.connected)
      .forEach((p) => {
        const sockets = socket_registry.get(p.id);
        if (!sockets) return;
        sockets.values().forEach((ws) => ws.send(stringified_message));
      });
  },

  broadcastToOthers: async (userId: string, message: SessionWsResponse) => {
    const session = SessionCacheRegistry.getUserSession(userId);
    if (!session) {
      return;
    }

    const stringified_message = JSON.stringify(message);
    session.participants
      .filter((p) => p.connected && p.id != userId)
      .forEach((p) => {
        const sockets = socket_registry.get(p.id);
        if (!sockets) return;
        sockets.values().forEach((ws) => ws.send(stringified_message));
      });
  },
};
