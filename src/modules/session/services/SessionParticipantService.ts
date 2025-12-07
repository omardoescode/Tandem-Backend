import type { Session } from "../entities/Session";
import { SessionParticipant } from "../entities/SessionParticipant";
import { SessionParticipantRepository } from "../repositories/SessionParticipantRepository";

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
  },
};
