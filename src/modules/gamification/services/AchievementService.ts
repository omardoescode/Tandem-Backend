import type { AchievementData } from "../entities/Achievement";
import { AchievementRepository } from "../repositories/AchievementRepository";

const getAchievements = async (): Promise<AchievementData[]> => {
  const achievements = await AchievementRepository.getAchievements();
  return achievements.map((a) => a.getCommittedState());
};

export const AchievementService = {
  getAchievements,
};
