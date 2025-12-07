import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { upgradeWebSocket } from "hono/bun";
import { WebSocketRegistry } from "../services/WebSocketRegistry";
import { UserRepository } from "@/modules/auth/UserRepository";
import { SessionWSMessageSchema, type SessionWsMessage } from "../validation";
import assert from "assert";
import type { WSContext } from "hono/ws";
import { TicketService } from "../services/TicketService";
import { protectedRoute } from "@/modules/auth/middleware";
import { SuccessResponse } from "@/utils/responses";
import { WSService } from "../services/WSService";

const sessionRouter = new Hono();

sessionRouter.get("ticket", protectedRoute, async (c) => {
  const user = c.get("user");
  const ticket = TicketService.addTicket(user.id);
  return c.json(SuccessResponse({ ticket }));
});

sessionRouter.get(
  "/ws",
  describeRoute({
    description: "The entire peer-matching, session, and checkin endpoint",
  }),
  upgradeWebSocket(async (c) => {
    const ticket = c.req.query("ticket");
    const fail_result = (reason: string) => ({
      onOpen(_: Event, ws: WSContext) {
        ws.send(JSON.stringify({ error: reason }));
        ws.close();
      },
    });

    if (!ticket) return fail_result("No ticket given");
    const userId = TicketService.useTicket(ticket);
    if (!userId) return fail_result("Invalid User");
    const user = await UserRepository.getByUserId(userId);
    if (!user) return fail_result("User not found in DB");

    // Successful
    const ws_id = crypto.randomUUID();

    return {
      async onOpen(_, ws) {
        WebSocketRegistry.addSocket(userId, ws_id, ws);
        await WSService.handleReconnect(user);
      },
      async onMessage(event, ws) {
        assert(userId);
        let parsed: SessionWsMessage | null;
        try {
          const data = JSON.parse(event.data.toString());
          parsed = SessionWSMessageSchema.parse(data);
        } catch (_) {
          ws.send(
            JSON.stringify({
              type: "error",
              error: "invalid token",
            }),
          );
          ws.close();

          return;
        }

        assert(parsed !== null);
        WSService.handleMessage(parsed, user);
      },
      async onClose() {
        WebSocketRegistry.disconnectSocket(userId, ws_id);
      },
      onError(event, _) {
        console.error(`WebSocket error for ${userId}:`, event);
      },
    };
  }),
);

export default sessionRouter;
