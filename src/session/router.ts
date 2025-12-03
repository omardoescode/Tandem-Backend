import { protectedRoute } from "@/auth/middleware";
import { SuccessResponse } from "@/utils/responses";
import { Hono } from "hono";
import { upgradeWebSocket } from "hono/bun";
import { describeRoute } from "hono-openapi";
import { SessionWSMessageSchema, type SessionWsMessage } from "./validation";
import assert from "assert";
import { TicketManagerContext } from "./TicketManagerActor";
import { ConnContext } from "./ConnActor";
import { SessionContext } from "./SessionActor";
import { TaskContext } from "./TaskActor";
import { DBClientContext } from "./DBClientActor";
import { PeerMatchingContext } from "./PeerMatchingActor";
import { v4 } from "uuid";

const sessionRouter = new Hono();

const ticket_ctx = new TicketManagerContext();
const ticket_ref = await ticket_ctx.spawn("ticket-manager-singleton");

ticket_ref.send({
  type: "AddTicket",
  user_id: "CLp1lNLXXn8VXr8l2YhlUEksOsFMSZpD",
  expiration_seconds: -1,
});

ticket_ref.send({
  type: "AddTicket",
  user_id: "ZoMjT1C6sGnc3yCfldfO4wkctk9HvfJf",
  expiration_seconds: -1,
});

const db_client_ctx = new DBClientContext();
const task_ctx = new TaskContext();
const session_ctx = new SessionContext(task_ctx);
const user_ctx = new ConnContext(task_ctx, db_client_ctx);
const peer_matching_ctx = new PeerMatchingContext(
  session_ctx,
  db_client_ctx,
  user_ctx,
);

const peer_matching_ref = await peer_matching_ctx.spawn(
  "peer-matching-singleton",
);
user_ctx.set_peer_matching_ref(peer_matching_ref);

sessionRouter.get(
  "get_ticket",
  describeRoute({
    description: "Say hello to the user",
    responses: {
      200: {
        description: "Successful response",
        content: {
          // "text/plain": { schema: resolver() },
        },
      },
    },
  }),
  protectedRoute,
  async (c) => {
    const user = c.get("user");
    const ticket = await ticket_ref.ask<string>({
      type: "AddTicket",
      user_id: user.id,
      expiration_seconds: 2 * 60,
    });
    return c.json(SuccessResponse({ ticket }));
  },
);

sessionRouter.get(
  "/ws",
  describeRoute({
    description: "The entire peer-matching, session, and checkin endpoint",
  }),
  upgradeWebSocket(async (c) => {
    const ticket = c.req.query("ticket");

    if (!ticket) {
      return {
        onOpen(_, ws) {
          ws.send(JSON.stringify({ error: "unauthorized" }));
          ws.close();
        },
      };
    }
    const user_id = await ticket_ref.ask<string | null>({
      type: "UseTicket",
      ticket_id: ticket,
    });

    if (!user_id)
      return {
        onOpen(_, ws) {
          ws.send(JSON.stringify({ error: "unauthorized" }));
          ws.close();
        },
      };

    const new_user = user_ctx.get_ref(user_id);
    const ws_id = v4();
    return {
      onOpen(_, ws) {
        new_user.send({
          type: "WSConnected",
          ws_id: ws_id,
          ws,
        });
      },
      async onMessage(event, ws) {
        assert(user_id);
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
        new_user.send({ type: "UserSendMessage", content: parsed });
      },
      async onClose() {
        console.log(`User ${user_id} disconnected.`);
        new_user.send({ type: "WSDisconnected", ws_id });
      },
      onError(event, _) {
        console.error(`WebSocket error for ${user_id}:`, event);
      },
    };
  }),
);

export default sessionRouter;
