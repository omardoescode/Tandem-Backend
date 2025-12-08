import type { AchievementData } from "../entities/Achievement";
import type { UserAchievementData } from "../entities/UserAchievement";
import { AchievementRepository } from "../repositories/AchievementRepository";
import { UserAchievementRepository } from "../repositories/UserAchievementRepository";

const getAchievementsData = async (): Promise<AchievementData[]> => {
  const achievements = await AchievementRepository.getAchievements();
  return achievements.map((a) => a.getCommittedState());
};

const getUserAhicevementsData = async (
  userId: string,
): Promise<UserAchievementData[]> => {
  const achievements =
    await UserAchievementRepository.getUserAchievements(userId);
  return achievements.map((a) => a.getCommittedState());
};

export const AchievementService = {
  getAchievementsData,
  getUserAhicevementsData,
};
