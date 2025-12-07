import { Entity } from "@/utils/Entity";

export interface UserStatsState {
  userId: string;
  level: number;
  currentXP: number;
  tillNextLevelXP: number;
  totalAchievements: number;
  totalCoins: number;
  totalFocusMinutes: number;
  totalBreakMinutes: number;
  createdAt: Date;
}

export class UserStats extends Entity<UserStatsState> {
  constructor(state: UserStatsState) {
    super(state);
  }
}
