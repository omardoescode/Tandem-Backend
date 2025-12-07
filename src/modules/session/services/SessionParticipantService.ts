import env from "@/utils/env";
import type { Session } from "../entities/Session";
import { SessionParticipant } from "../entities/SessionParticipant";
import { SessionParticipantRepository } from "../repositories/SessionParticipantRepository";
import { SessionCacheRegistry } from "./SessionCacheRegistry";

const disconnection_ms =
  env.SESSION_PARTICIPANT_DISCONNECTION_MAXIMUM_SECONDS * 1000;

const disconnectionTimers = new Map<string, Timer>();

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

    const timer = setTimeout(() => {
      SessionCacheRegistry.disconnectParticipant(userId);
      disconnectionTimers.delete(userId);
    }, disconnection_ms);

    disconnectionTimers.set(userId, timer);
  },
  reconnect(userId: string): boolean {
    return disconnectionTimers.delete(userId);
  },
};
