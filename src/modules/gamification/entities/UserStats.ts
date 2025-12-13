import logger from "@/lib/logger";
import type { SessionParticipant } from "@/modules/session/entities/SessionParticipant";
import { Entity } from "@/utils/Entity";
import { LevelService } from "../services/LevelService";
import { StoreService } from "../services/StoreService";

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

  public applySessionEffect(participant: SessionParticipant, worked: boolean) {
    const p = participant.getCommittedState();

    logger.info(`Updating User Stats for ${p.userId}`);
    this.add("totalSessionCount", 1);

    if (p.state === "disconnected") this.add("disConnectedSessionCount", 1);

    if (worked) {
      this.add("totalFocusMinutes", Math.floor(p.focusTimeSeconds / 60));
      this.add("totalBreakMinutes", Math.floor(p.breakTimeSeconds / 60));

      const new_xp = LevelService.calcSessionXp(
        p.focusTimeSeconds,
        p.breakTimeSeconds,
      );
      const { level, xpInLevel, xpToNext } = LevelService.handleXpGain(
        this.get("level"),
        this.get("currentXP"),
        new_xp,
      );
      this.set("level", level);
      this.set("currentXP", xpInLevel);
      this.set("tillNextLevelXP", xpToNext);

      const addedCoins = StoreService.calcSessionCoin(
        p.focusTimeSeconds,
        p.breakTimeSeconds,
      );
      this.add("currentCoins", addedCoins);
    }
  }
}
