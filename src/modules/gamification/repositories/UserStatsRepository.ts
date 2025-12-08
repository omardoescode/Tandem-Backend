import { db } from "@/db";
import { UserStats } from "../entities/UserStats";
import { UserStatsTable } from "@/db/schemas/gamification";
import { eq } from "drizzle-orm";
import LevelConfig from "@/resources/level_service_config.json" assert { type: "json" };
import logger from "@/lib/logger";

export interface IUserStatRepository {
  get(userId: string): Promise<UserStats>;
  save(...stat: UserStats[]): Promise<void>;
}

const defaultValues = (userId: string) => ({
  userId,
  level: 1,
  currentXP: 0,
  tillNextLevelXP: LevelConfig.xpBase,
});

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
      .values(defaultValues(userId))
      .returning();
    logger.info(`Inserting new User Stat table for ${userId}`);

    return new UserStats(inserted[0]!);
  },
  save: async (...stats: UserStats[]): Promise<void> => {
    await Promise.all(
      stats.map(async (stat) => {
        if (!stat.isDirty()) return;
        const changes = stat.getChanges();
        await db
          .update(UserStatsTable)
          .set(changes)
          .where(eq(UserStatsTable.userId, stat.get("userId")));
        stat.commit();
      }),
    );
  },
};
