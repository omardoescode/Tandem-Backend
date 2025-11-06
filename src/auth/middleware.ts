import { createMiddleware } from "hono/factory";
import { StatusCodes } from "http-status-codes";
import auth from "./lib";
import type { Session, User } from "./types";
import { ErrorResponse } from "utils/responses";

export const protectedRoute = createMiddleware<{
  Variables: {
    user: User;
    session: Session;
  };
}>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    c.status(StatusCodes.UNAUTHORIZED);
    return c.json(ErrorResponse("Unauthorized"));
  }

  c.set("user", session.user);
  c.set("session", session.session);
  return next();
});

export const ifLoggedIn = createMiddleware<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    c.set("user", null);
    c.set("session", null);
  } else {
    c.set("user", session.user);
    c.set("session", session.session);
  }

  return next();
});
