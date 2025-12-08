import { Entity } from "@/utils/Entity";

export interface UserAchievementData {
  userId: string;
  achievementId: string;
  createdAt: Date;
}

export class UserAchievement extends Entity<UserAchievementData> {
  constructor(state: UserAchievementData) {
    super(state);
  }
}
