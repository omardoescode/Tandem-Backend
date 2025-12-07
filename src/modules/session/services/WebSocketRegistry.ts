import type { WSContext } from "hono/ws";
import type { SessionWsResponse } from "../validation";
import { SessionService } from "./SessionService";

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
      // TODO: Keep up to date
    } else {
      existing = new Map();
      existing.set(ws_id, ws);
    }
    socket_registry.set(userId, existing);
  },

  disconnectSocket: async (userId: string, ws_id: string): Promise<boolean> => {
    const sockets = socket_registry.get(userId);
    if (!sockets) return false;
    const found = sockets.delete(ws_id);
    if (sockets.size == 0) {
      SessionService.handleDisconnect(userId);
      socket_registry.delete(userId);
    }
    return found;
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
};
