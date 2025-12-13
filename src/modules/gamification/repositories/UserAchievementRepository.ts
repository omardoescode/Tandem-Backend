import { db } from "@/db";
import { UserAchievementTable } from "@/db/schemas/gamification";
import { UserAchievement } from "../entities/UserAchievement";
import { eq, and } from "drizzle-orm";
import logger from "@/lib/logger";

export interface IUserAchievementRepository {
  getByUserAndAchievement(
    userId: string,
    achievementId: string,
  ): Promise<UserAchievement | null>;
  getUserAchievements(userId: string): Promise<UserAchievement[]>;
  save(...userAchievements: UserAchievement[]): Promise<void>;
}

export const UserAchievementRepository: IUserAchievementRepository = {
  async getByUserAndAchievement(userId, achievementId) {
    const result = await db
      .select({
        createdAt: UserAchievementTable.createdAt,
      })
      .from(UserAchievementTable)
      .where(
        and(
          eq(UserAchievementTable.userId, userId),
          eq(UserAchievementTable.achievementId, achievementId),
        ),
      );

    if (result.length === 0) {
      return null;
    }

    return new UserAchievement({ userId, achievementId, ...result[0]! });
  },
  async getUserAchievements(userId: string) {
    const res = await db
      .select()
      .from(UserAchievementTable)
      .where(eq(UserAchievementTable.userId, userId));

    return res.map((r) => new UserAchievement(r));
  },
  async save(...userAchievements) {
    await Promise.all(
      userAchievements.map(async (ua) => {
        const userId = ua.get("userId");
        const achievementId = ua.get("achievementId");
        if (!ua.isDirty()) {
          logger.warn(
            `UserAchievement (userId=${userId}, achievementId=${achievementId}) is not dirty. Avoid call to DB`,
          );
          return;
        }
        const changes = ua.getChanges();
        await db
          .insert(UserAchievementTable)
          .values({
            ...ua.getCommittedState(),
            ...ua.getChanges(),
          })
          .onConflictDoUpdate({
            target: [
              UserAchievementTable.userId,
              UserAchievementTable.achievementId,
            ],
            set: changes,
          });
        ua.commit();
      }),
    );
  },
};
