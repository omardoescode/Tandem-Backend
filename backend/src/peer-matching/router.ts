import { Hono } from "hono";
import { upgradeWebSocket } from "hono/bun";

const MatchingRouter = new Hono();

MatchingRouter.get(
  "/",
  upgradeWebSocket((c) => {
    return {
      onOpen(event, ws) {
        console.log("Connection Opened");
      },
      onMessage(event, ws) {
        console.log(`Message from client: ${event.data}`);
        ws.send("Hello from server!");
      },
    };
  }),
);

export default MatchingRouter;
