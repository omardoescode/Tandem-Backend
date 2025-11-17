import { protectedRoute } from "@/auth/middleware";
import { SuccessResponse } from "@/utils/responses";
import { Hono } from "hono";
import { upgradeWebSocket } from "hono/bun";
import { v7 as uuid } from "uuid";
import { describeRoute } from "hono-openapi";
import { SessionWSMessageSchema, type SessionWsMessage } from "./validation";
import assert from "assert";
import { ConnectionManager } from "./service";

const sessionRouter = new Hono();

// TODO: Replace with redis or postgres db
const tickets: Record<string, string> = {
  "0": "Q1glnkoN5AgrMbzOsJ1lwwF4TeQkbZX7",
  "1": "D59Zhqy5SVul8j4DN4W9i47Aq3HdBKWN",
};

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
    const ticket = uuid();
    tickets[ticket] = user.id;
    console.log(tickets);

    return c.json(SuccessResponse({ ticket }));
  },
);

sessionRouter.get(
  "/ws",
  describeRoute({
    description: "The entire peer-matching, session, and checkin endpoint",
  }),
  upgradeWebSocket((c) => {
    const ticket = c.req.query("ticket");
    const user_id = ticket ? tickets[ticket] : null;

    // TODO: Keep them for development
    // if (ticket) delete tickets[ticket]; // One-time use

    return {
      onOpen(evt, ws) {
        if (!user_id) {
          ws.send(
            JSON.stringify({
              error: "invalid token",
            }),
          );
          ws.close();
          return;
        }
        ConnectionManager.instance().initConn(ws, user_id);
      },
      async onMessage(event, ws) {
        assert(user_id);
        let parsed: SessionWsMessage | null;
        try {
          const data = JSON.parse(event.data.toString());
          parsed = SessionWSMessageSchema.parse(data);
        } catch (err) {
          console.log(err);
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

        const res = await ConnectionManager.instance().handleMessage(
          user_id,
          parsed,
        );
        if (res.isSome()) throw res.unwrap();
      },
      onClose(event, ws) {
        console.log(`User ${user_id} disconnected.`);
      },
      onError(event, ws) {
        console.error(`WebSocket error for ${user_id}:`, event);
      },
    };
  }),
);

export default sessionRouter;
