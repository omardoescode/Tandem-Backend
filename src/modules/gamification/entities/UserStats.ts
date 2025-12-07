import { Entity } from "@/utils/Entity";

export interface UserStatsData {
  userId: string;
  level: number;
  currentXP: number;
  tillNextLevelXP: number;
  totalAchievements: number;
  currentCoins: number;
  totalCoins: number;
  totalFocusMinutes: number;
  totalBreakMinutes: number;
  createdAt: Date;
}

export class UserStats extends Entity<UserStatsData> {
  constructor(state: UserStatsData) {
    super(state);
  }
}
