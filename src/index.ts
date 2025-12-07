import { Hono } from "hono";
import env from "./utils/env";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import authRouter from "./modules/auth/router";
import sessionRouter from "./modules/session/router";
import { openAPIRouteHandler } from "hono-openapi";
import { Scalar } from "@scalar/hono-api-reference";

import { websocket } from "hono/bun";
const app = new Hono().basePath("/api");
app.use(logger());

app.use(
  "*",
  cors({
    origin: "http://localhost:5000",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["POST", "GET", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  }),
);

app.route("auth/*", authRouter);
app.route("session/", sessionRouter);

app.get("", (c) => c.text("hello"));

app.get(
  "/openapi.json",
  openAPIRouteHandler(app, {
    documentation: {
      info: {
        title: "Tandem Documentation",
        version: "1.2.0",
        description: "This is an API to help ",
      },
      servers: [
        {
          url: "http://localhost:3000",
          description: "Local server",
        },
      ],
    },
  }),
);
app.get(
  "/docs",
  Scalar({
    theme: "kepler",
    url: "/api/openapi.json",
  }),
);

export default {
  fetch: app.fetch,
  port: env.PORT,
  websocket,
};
