import { db } from "@/db";
import { AchievementTable } from "@/db/schemas/gamification";
import { Achievement } from "../entities/Achievement";
import { eq } from "drizzle-orm";

export interface IAchievementRepository {
  getAchievements(): Promise<Achievement[]>;
  getById(achievementId: string): Promise<Achievement | null>;
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
};
