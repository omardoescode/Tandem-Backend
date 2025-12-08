import { db } from "@/db";
import {
  SessionParticipantTable,
  TandemSessionTable,
} from "@/db/schemas/session";
import { Session } from "../entities/Session";
import { and, desc, eq } from "drizzle-orm";
import logger from "@/lib/logger";

export interface ISessionRepository {
  getBySessionId(sessionId: string): Promise<Session | null>;
  getLastDisconnectedSession(userId: string): Promise<Session | null>;
  save(...sessions: Session[]): Promise<void>;
}

export const SessionRepository: ISessionRepository = {
  async getBySessionId(sessionId) {
    const result = await db
      .select({
        state: TandemSessionTable.state,
        startTime: TandemSessionTable.startTime,
        scheduledDuration: TandemSessionTable.scheduledDuration,
      })
      .from(TandemSessionTable)
      .where(eq(TandemSessionTable.sessionId, sessionId));

    if (result.length === 0) {
      return null;
    }

    return new Session({ sessionId, ...result[0]! });
  },
  async save(...sessions) {
    await Promise.all(
      sessions.map(async (session) => {
        const sessionId = session.get("sessionId");
        if (!session.isDirty()) {
          logger.warn(
            `Session (sessionId=${sessionId}) is not dirty. Avoid call to DB`,
          );
          return;
        }
        const changes = session.getChanges();
        await db
          .insert(TandemSessionTable)
          .values({
            ...session.getCommittedState(),
            ...changes,
          })
          .onConflictDoUpdate({
            target: TandemSessionTable.sessionId,
            set: changes,
          });

        session.commit();
      }),
    );
  },
  async getLastDisconnectedSession(userId: string): Promise<Session | null> {
    const result = await db
      .select({
        sessionId: TandemSessionTable.sessionId,
        state: TandemSessionTable.state,
        startTime: TandemSessionTable.startTime,
        scheduledDuration: TandemSessionTable.scheduledDuration,
      })
      .from(SessionParticipantTable)
      .innerJoin(
        TandemSessionTable,
        eq(SessionParticipantTable.sessionId, TandemSessionTable.sessionId),
      )
      .where(
        and(
          eq(SessionParticipantTable.userId, userId),
          eq(SessionParticipantTable.state, "disconnected"),
        ),
      )
      .orderBy(desc(TandemSessionTable.startTime))
      .limit(1);

    if (result.length === 0) return null;

    // drizzle result comes as: { session_participant: {...}, tandem_session: {...} }
    const row = result[0]!;

    return new Session({
      sessionId: row.sessionId,
      state: row.state,
      startTime: row.startTime,
      scheduledDuration: row.scheduledDuration,
    });
  },
};
