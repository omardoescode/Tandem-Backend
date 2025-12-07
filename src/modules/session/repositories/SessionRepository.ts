import { db } from "@/db";
import { TandemSessionTable } from "@/db/schemas/session";
import { Session } from "../entities/Session";
import { eq } from "drizzle-orm";
import logger from "@/lib/logger";

export interface ISessionRepository {
  getBySessionId(sessionId: string): Promise<Session | null>;
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
            ...session.getChanges(),
          })
          .onConflictDoUpdate({
            target: TandemSessionTable.sessionId,
            set: changes,
          });

        session.commit();
      }),
    );
  },
};
