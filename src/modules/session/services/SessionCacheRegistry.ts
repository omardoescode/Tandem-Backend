import logger from "@/lib/logger";

type CachedSessionState = "working" | "checkin";
interface SessionCacheEntry {
  sessionId: string;
  state: CachedSessionState;
  users: string[];
}

const sessionCache = new Map<string, Omit<SessionCacheEntry, "sessionId">>();
const userToSessionCache = new Map<string, string>();

export const SessionCacheRegistry = {
  addSession(
    sessionId: string,
    users: string[],
    initial_state: CachedSessionState = "working",
  ) {
    sessionCache.set(sessionId, { state: initial_state, users });
    users.forEach((u) => userToSessionCache.set(u, sessionId));
  },

  moveToCheckin(sessionId: string) {
    const session = sessionCache.get(sessionId);
    if (!session) {
      logger.warn(`Session not in cache (sessionId=${sessionId})`);
      return;
    }

    if (session.state == "checkin") {
      logger.warn(
        `Session in cache is already in checkin (sessionId=${sessionId})`,
      );
      return;
    }

    session.state = "checkin";
  },

  hasSession: (sessionId: string) => sessionCache.has(sessionId),
  hasUser: (userId: string) => userToSessionCache.has(userId),

  getUserSession: (userId: string): SessionCacheEntry | null => {
    const sessionId = userToSessionCache.get(userId);
    if (!sessionId) return null;
    const session = sessionCache.get(sessionId);
    return session !== undefined ? { ...session, sessionId } : null;
  },

  getUserSessionId: (userId: string): string | null => {
    const res = userToSessionCache.get(userId);
    return res ? res : null;
  },

  deleteSessionCache: (sessionId: string) => {
    const session = sessionCache.get(sessionId);
    if (!session) return false;
    session.users.forEach((u) => userToSessionCache.delete(u));
    sessionCache.delete(sessionId);
    return true;
  },
};
