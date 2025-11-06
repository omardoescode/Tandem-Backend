import { cors } from "hono/cors";
import { Hono } from "hono";
import authRouter from "@/auth/router";
import MatchingRouter from "./peer-matching/router";
import { websocket } from "hono/bun";

const app = new Hono().basePath("api/");

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
app.route("match/*", MatchingRouter);
app.get("/", (c) => c.text("hello world"));

export default {
  fetch: app.fetch,
  websocket,
};
