import logger from "@/lib/logger";

type CachedSessionState = "running" | "checkin";

interface ParticipantCache {
  id: string;
  connected: boolean;
  reported: boolean;
}

interface SessionCacheEntry {
  sessionId: string;
  state: CachedSessionState;
  participants: ParticipantCache[];
  entirelyDisconnectedParticipants: ParticipantCache[];
}

const sessionCache = new Map<string, Omit<SessionCacheEntry, "sessionId">>();
const userToSessionCache = new Map<string, string>();

const getParticipantCache = (userId: string): ParticipantCache | null => {
  const sessionId = userToSessionCache.get(userId);
  if (!sessionId) return null;
  const session = sessionCache.get(sessionId);
  if (!session) return null;
  const participant_cache = session.participants.find((p) => p.id === userId);
  if (!participant_cache) return null;
  return participant_cache;
};

export const SessionCacheRegistry = {
  addSession(
    sessionId: string,
    participants: string[],
    initial_state: CachedSessionState = "running",
  ) {
    sessionCache.set(sessionId, {
      state: initial_state,
      participants: participants.map((p) => ({
        id: p,
        connected: true,
        reported: false,
      })),
      entirelyDisconnectedParticipants: [],
    });

    participants.forEach((u) => userToSessionCache.set(u, sessionId));
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
    return SessionCacheRegistry.getSession(sessionId);
  },

  getSession(sessionId: string): SessionCacheEntry | null {
    const res = sessionCache.get(sessionId);
    return res ? { ...res, sessionId } : null;
  },

  getUserSessionId: (userId: string): string | null => {
    const res = userToSessionCache.get(userId);
    return res ? res : null;
  },

  deleteSessionCache: (sessionId: string) => {
    const session = sessionCache.get(sessionId);
    if (!session) return false;
    session.participants.forEach((u) => userToSessionCache.delete(u.id));
    sessionCache.delete(sessionId);
    return true;
  },

  // By deleting a user from cache, all changes won't occur to this user from now, and the disconnected state will persist
  disconnectParticipant: (participantId: string): boolean => {
    const sessionId = userToSessionCache.get(participantId);
    if (!sessionId) return false;

    const session = sessionCache.get(sessionId);
    if (!session) return false;

    const index = session.participants.findIndex((v) => v.id === participantId);
    if (index === -1) return false;

    const [removed] = session.participants.splice(index, 1);

    session.entirelyDisconnectedParticipants.push(removed!);
    return true;
  },

  // TODO: Use this on re-entry  to a session again
  setParticipantConnection(userId: string, connected: boolean) {
    const participant = getParticipantCache(userId);
    if (!participant) {
      logger.warn(`Participant cache not found. (userId=${userId})`);
      return;
    }

    participant.connected = connected;
  },

  // TODO: Figure out where to use this method?? [Is this a method or a function??]
  report(userId: string) {
    const participant = getParticipantCache(userId);
    if (!participant) {
      logger.warn(`Participant cache not found. (userId=${userId})`);
      return;
    }

    participant.reported = true;
  },
};
