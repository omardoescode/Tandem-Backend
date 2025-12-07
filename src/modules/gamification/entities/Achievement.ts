import { Entity } from "@/utils/Entity";

export interface AchievementState {
  achievementId: string;
  name: string;
  description?: string;
}

export class Achievement extends Entity<AchievementState> {
  constructor(state: AchievementState) {
    super(state);
  }
}
