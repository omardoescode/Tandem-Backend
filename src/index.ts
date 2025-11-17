import { cors } from "hono/cors";
import { Hono } from "hono";
import authRouter from "@/auth/router";
import { websocket } from "hono/bun";
import { logger } from "hono/logger";
import sessionRouter from "./session/router";
import { openAPIRouteHandler } from "hono-openapi";
import { Scalar } from "@scalar/hono-api-reference";

const app = new Hono().basePath("api/");

app.use(logger());
app.use(
  "*",
  cors({
    origin: "http://localhost:5000", // frontend port
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["POST", "GET", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  }),
);

app.route("auth/*", authRouter);
app.route("session", sessionRouter);
app.get("/", (c) => c.text("hello world"));

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
  websocket,
};
