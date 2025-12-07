import { db } from "@/db";
import { AchievementTable } from "@/db/schemas/gamification";
import { Achievement } from "../entities/Achievement";
import { eq } from "drizzle-orm";
import logger from "@/lib/logger";

export interface IAchievementRepository {
  getAchievements(): Promise<Achievement[]>;
  getById(achievementId: string): Promise<Achievement | null>;
  save(...achievements: Achievement[]): Promise<void>;
}

export const AchievementRepository: IAchievementRepository = {
  async getById(achievementId) {
    const result = await db
      .select()
      .from(AchievementTable)
      .where(eq(AchievementTable.achievementId, achievementId));

    if (result.length === 0) return null;

    return new Achievement(result[0]!);
  },

  async getAchievements() {
    const result = await db.select().from(AchievementTable);
    return result.map((r) => new Achievement(r));
  },

  async save(...achievements) {
    await Promise.all(
      achievements.map(async (achievement) => {
        const achievementId = achievement.get("achievementId");
        if (!achievement.isDirty()) {
          logger.warn(
            `Achievement (achievementId=${achievementId}) is not dirty. Avoid call to DB`,
          );
          return;
        }
        const changes = achievement.getChanges();
        await db
          .insert(AchievementTable)
          .values({
            ...achievement.getCommittedState(),
            ...achievement.getChanges(),
          })
          .onConflictDoUpdate({
            target: AchievementTable.achievementId,
            set: changes,
          });
        achievement.commit();
      }),
    );
  },
};
