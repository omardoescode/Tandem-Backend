import { Hono } from "hono";
import auth from "./lib";

const authRouter = new Hono();

authRouter.on(["POST", "GET"], "", (c) => {
  return auth.handler(c.req.raw);
});

export default authRouter;
