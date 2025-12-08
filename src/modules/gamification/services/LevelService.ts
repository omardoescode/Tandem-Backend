import LevelConfig from "@/resources/level_service_config.json" assert { type: "json" };

export const LevelService = {
  config: LevelConfig,

  xpForLevel(level: number): number {
    if (level <= 1) return 0;
    return Math.floor(
      this.config.xpBase * Math.pow(this.config.multiplier, level - 2),
    );
  },

  totalXpForLevel(level: number): number {
    let total = 0;
    for (let i = 2; i <= level; i++) {
      total += this.xpForLevel(i);
    }
    return total;
  },

  /**
   * Given absolute cumulative XP, derive:
   * - level
   * - current XP within that level
   * - XP required to reach next level
   */
  getLevelFromTotalXp(totalXp: number): {
    level: number;
    xpInLevel: number;
    xpToNext: number;
  } {
    let level = 1;
    let accumulated = 0;

    while (true) {
      const next = this.xpForLevel(level + 1);

      if (
        accumulated + next > totalXp ||
        (this.config.maxLevel && level >= this.config.maxLevel)
      ) {
        break;
      }

      accumulated += next;
      level++;
    }

    return {
      level,
      xpInLevel: totalXp - accumulated,
      xpToNext: this.xpForLevel(level + 1),
    };
  },

  /**
   * Apply XP gain based on user's current level + current XP inside that level.
   */
  handleXpGain(
    currentLevel: number,
    currentXpInLevel: number,
    addedXp: number,
  ): {
    level: number;
    xpInLevel: number;
    xpToNext: number;
  } {
    const totalBefore = this.totalXpForLevel(currentLevel) + currentXpInLevel;

    const totalAfter = totalBefore + addedXp;

    return this.getLevelFromTotalXp(totalAfter);
  },

  /**
   * Calculates XP given session focus/break duration.
   * Formula:
   *   - 1 XP per focus minute
   *   - 0.25 XP per break minute
   * Change multipliers as needed.
   */
  calcSessionXp(focusSeconds: number, breakSeconds: number): number {
    return Math.floor(
      focusSeconds * this.config.xpPerFocusSecond +
        breakSeconds * this.config.xpPerBreakSecond,
    );
  },
};
