import type { Context } from "hono";
import { createMiddleware } from "hono/factory";

/**
 * A middleware used for server-sent events.
 * Keeps a connection alive
 */
const sse = createMiddleware(async (c: Context, next) => {
  c.header("Content-Type", "text/event-stream");
  c.header("Cache-Control", "no-cache");
  c.header("Connection", "keep-alive");
  await next();
});

export default sse;
