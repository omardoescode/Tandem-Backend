import logger from "@/lib/logger";
import type { Session } from "../entities/Session";
import { SessionParticipant } from "../entities/SessionParticipant";
import { SessionParticipantRepository } from "../repositories/SessionParticipantRepository";
import { SessionRepository } from "../repositories/SessionRepository";
import { SessionCacheRegistry } from "./SessionCacheRegistry";
import assert from "assert";

export const SessionParticipantService = {
  createSessionParticipants: async (
    sessionId: string,
    partners: { userId: string; tasks: string[] }[],
  ): Promise<SessionParticipant[]> => {
    const participants = partners.map(
      (p) =>
        new SessionParticipant(
          {
            sessionId,
            state: "working",
            userId: p.userId,
            focusTimeSeconds: 0,
            breakTimeSeconds: 0,
          },
          { initiallyDirty: true },
        ),
    );

    await SessionParticipantRepository.save(...participants);
    return participants;
  },

  async handleDisconnect(session: Session, userId: string) {
    const participant =
      await SessionParticipantRepository.getByUserIdAndSessionId(
        userId,
        session.get("sessionId"),
      );

    if (!participant) return;
    if (participant.get("state") === "complete") return;

    participant.disconnect();
    await SessionParticipantRepository.save(participant);

    SessionCacheRegistry.setParticipantConnection(userId, false);

    const session_cache = SessionCacheRegistry.getUserSession(userId);
    assert(session_cache);

    if (!session_cache.participants.some((p) => p.connected)) {
      session.disconnect();
      await SessionRepository.save(session);
      logger.info(
        `Session disconnected (sessionId=${session.get("sessionId")})`,
      );

      // TODO: Save this also in cache with a timer for a duration equal to user disconnection duration. If not re-connected, go back to its former state, if not, go back
      // TODO: Consider the case if a session is disconnected, but a checkin timer still exists
      // NOTE: I think the solution is omitting disconnection out of the state to make it a linear process
    }
  },
};
