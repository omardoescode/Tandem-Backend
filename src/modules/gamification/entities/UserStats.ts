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
  totalSessionCount: number;
  disConnectedSessionCount: number;
  createdAt: Date;
}

export class UserStats extends Entity<UserStatsData> {
  public add<
    T extends {
      [K in keyof UserStatsData]: UserStatsData[K] extends number ? K : never;
    }[keyof UserStatsData],
  >(field: T, value: number) {
    this.set(field, this.get(field) + value);
  }
}
