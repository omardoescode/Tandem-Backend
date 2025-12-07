import { db } from "@/db";
import { UserStats } from "../entities/UserStats";
import { UserStatsTable } from "@/db/schemas/gamification";
import { eq } from "drizzle-orm";

export interface IUserStatRepository {
  get(userId: string): Promise<UserStats>;
}

export const UserStatsRepository: IUserStatRepository = {
  get: async (userId: string): Promise<UserStats> => {
    const existing = await db
      .select()
      .from(UserStatsTable)
      .where(eq(UserStatsTable.userId, userId));

    if (existing.length > 0) {
      return new UserStats(existing[0]!);
    }

    const inserted = await db
      .insert(UserStatsTable)
      .values({
        userId,
        level: 1,
        currentXP: 0,
        tillNextLevelXP: 0, // TODO: Do the maths for this one
      })
      .returning();

    return new UserStats(inserted[0]!);
  },
};
