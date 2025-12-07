import { db } from "@/db";
import { SessionParticipant } from "../entities/SessionParticipant";
import { SessionParticipantTable } from "@/db/schemas/session";
import { and, eq, sql } from "drizzle-orm";

export interface ISessionParticipantRepository {
  getByUserIdAndSessionId(
    userId: string,
    sessionId: string,
  ): Promise<SessionParticipant | null>;
  getBySessionId(sessionId: string): Promise<SessionParticipant[]>;
  getWorkingSessionParticipants(
    sessionId: string,
  ): Promise<SessionParticipant[]>;
  getWorkingSessionParticipantsCount(sessionId: string): Promise<number>;
  getSessionCount(userId: string): Promise<number>;
  save(...participants: SessionParticipant[]): Promise<void>;
}

export const SessionParticipantRepository: ISessionParticipantRepository = {
  getByUserIdAndSessionId: async (userId: string, sessionId: string) => {
    const result = await db
      .select()
      .from(SessionParticipantTable)
      .where(
        and(
          eq(SessionParticipantTable.sessionId, sessionId),
          eq(SessionParticipantTable.userId, userId),
        ),
      );

    if (result.length === 0) return null;
    return new SessionParticipant(result[0]!);
  },

  getBySessionId: async (sessionId: string): Promise<SessionParticipant[]> => {
    const result = await db
      .select()
      .from(SessionParticipantTable)
      .where(eq(SessionParticipantTable.sessionId, sessionId));

    return result.map((r) => new SessionParticipant(r));
  },

  getWorkingSessionParticipants: async (
    sessionId: string,
  ): Promise<SessionParticipant[]> => {
    const result = await db
      .select()
      .from(SessionParticipantTable)
      .where(
        and(
          eq(SessionParticipantTable.sessionId, sessionId),
          eq(SessionParticipantTable.state, "working"),
        ),
      );

    return result.map((r) => new SessionParticipant(r));
  },

  getWorkingSessionParticipantsCount: async (
    sessionId: string,
  ): Promise<number> => {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(SessionParticipantTable)
      .where(
        and(
          eq(SessionParticipantTable.sessionId, sessionId),
          eq(SessionParticipantTable.state, "working"),
        ),
      );

    return result[0]?.count ?? 0;
  },

  getSessionCount: async (userId: string): Promise<number> => {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(SessionParticipantTable)
      .where(eq(SessionParticipantTable.userId, userId));

    return result[0]?.count ?? 0;
  },
  save: async (...participants: SessionParticipant[]): Promise<void> => {
    await Promise.all(
      participants.map(async (participant) => {
        if (!participant.isDirty()) return;
        const changes = participant.getChanges();
        await db
          .insert(SessionParticipantTable)
          .values({
            ...participant.getCommittedState(),
            ...participant.getChanges(),
          })
          .onConflictDoUpdate({
            target: [
              SessionParticipantTable.userId,
              SessionParticipantTable.sessionId,
            ],
            set: changes,
          });
        participant.commit();
      }),
    );
  },
};
