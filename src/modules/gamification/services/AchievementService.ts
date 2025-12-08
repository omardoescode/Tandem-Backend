import { SessionRepository } from "@/modules/session/repositories/SessionRepository";
import type { AchievementData } from "../entities/Achievement";
import type { UserAchievementData } from "../entities/UserAchievement";
import { AchievementRepository } from "../repositories/AchievementRepository";
import { UserAchievementRepository } from "../repositories/UserAchievementRepository";
import logger from "@/lib/logger";
import { SessionParticipantRepository } from "@/modules/session/repositories/SessionParticipantRepository";
import { TaskRepository } from "@/modules/session/repositories/TaskRepository";
import { UserStats } from "../entities/UserStats";
import { UserStatsRepository } from "../repositories/UserStatsRepository";
import { LevelService } from "./LevelService";
import { StoreService } from "./StoreService";

const getAchievements = async (): Promise<AchievementData[]> => {
  const achievements = await AchievementRepository.getAchievements();
  return achievements.map((a) => a.getCommittedState());
};

const getUserAhicevements = async (
  userId: string,
): Promise<UserAchievementData[]> => {
  const achievements =
    await UserAchievementRepository.getUserAchievements(userId);
  return achievements.map((a) => a.getCommittedState());
};

export const AchievementService = {
  getAchievements,
  getUserAhicevements,
};
