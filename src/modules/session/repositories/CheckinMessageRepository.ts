import { db } from "@/db";
import { CheckinMessageTable } from "@/db/schemas/session";
import { eq } from "drizzle-orm";
import { CheckinMessage } from "../entities/CheckinMessage";

export interface ICheckinMessageRepository {
  getSessionMessages(sessionId: string): Promise<CheckinMessage[]>;

  save(...reports: CheckinMessage[]): Promise<void>;
}

export const CheckinMessageRepository: ICheckinMessageRepository = {
  getSessionMessages: async (sessionId: string): Promise<CheckinMessage[]> => {
    const messages = await db
      .select()
      .from(CheckinMessageTable)
      .where(eq(CheckinMessageTable.sessionId, sessionId))
      .orderBy(CheckinMessageTable.orderingSeq);

    return messages.map((msg) => new CheckinMessage(msg));
  },
  save: async (...messages: CheckinMessage[]): Promise<void> => {
    await Promise.all(
      messages.map(async (message) => {
        if (!message.isDirty()) return;
        const changes = message.getChanges();

        await db
          .insert(CheckinMessageTable)
          .values({
            ...message.getCommittedState(),
            ...message.getChanges(),
          })
          .onConflictDoUpdate({
            target: CheckinMessageTable.messageId,
            set: changes,
          });
        message.commit();
      }),
    );
  },
};
