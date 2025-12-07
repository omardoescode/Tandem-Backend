import { Entity } from "@/utils/Entity";

export interface UserAchievementState {
  userId: string;
  achievementId: string;
  createdAt: Date;
}

export class UserAchievement extends Entity<UserAchievementState> {
  constructor(state: UserAchievementState) {
    super(state);
  }
}
