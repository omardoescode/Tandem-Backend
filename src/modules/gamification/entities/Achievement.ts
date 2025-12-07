import { Entity } from "@/utils/Entity";

export interface AchievementData {
  achievementId: string;
  name: string;
  description: string | null;
}

export class Achievement extends Entity<AchievementData> {}
