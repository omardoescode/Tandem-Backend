import logger from "@/lib/logger";
import { SessionParticipantRepository } from "@/modules/session/repositories/SessionParticipantRepository";
import { PurchaseRepository } from "../repositories/PurchaseRepository";
import { UserStatsRepository } from "../repositories/UserStatsRepository";
import type { UserStatsData } from "../entities/UserStats";

const predicates = new Map<string, (userId: string) => Promise<boolean>>();

const sessionCountAchievement =
  (prd: (cnt: number) => boolean) => async (userId: string) => {
    const s = await SessionParticipantRepository.getSessionCount(userId);
    return prd(s);
  };

const purchaseCountAchievement =
  (prd: (cnt: number) => boolean) => async (userId: string) => {
    const s = await PurchaseRepository.countByUser(userId);
    return prd(s);
  };

const userStatAchievement =
  (prd: (cnt: UserStatsData) => boolean) => async (userId: string) => {
    const s = await UserStatsRepository.get(userId);
    return prd(s.getCommittedState());
  };

predicates.set(
  "first_session",
  sessionCountAchievement((s) => s >= 1),
);

predicates.set(
  "five_sessions",
  sessionCountAchievement((s) => s >= 5),
);

predicates.set(
  "ten_sessions",
  sessionCountAchievement((s) => s >= 10),
);

predicates.set(
  "first_purchase",
  purchaseCountAchievement((s) => s >= 1),
);

predicates.set(
  "hundred_coins",
  userStatAchievement((s) => s.totalCoins >= 100),
);

predicates.set(
  "focus_master",
  userStatAchievement((s) => s.totalFocusMinutes >= 100),
);

export const AchievementPredicates = {
  testAchievement: async (userId: string, achievementId: string) => {
    const predicate = predicates.get(achievementId);

    if (!predicate) {
      logger.warn(`Achievement predicate not found ${achievementId}`);
      return false;
    }

    return predicate(userId);
  },
};
