import logger from "@/lib/logger";
import { SessionParticipantRepository } from "@/modules/session/repositories/SessionParticipantRepository";
import { UserStatsRepository } from "../repositories/UserStatsRepository";
import { LevelService } from "./LevelService";
import { StoreService } from "./StoreService";
import { SessionRepository } from "@/modules/session/repositories/SessionRepository";
import type { UserStatsData } from "../entities/UserStats";
import { CheckinReportRepository } from "@/modules/session/repositories/CheckinReportRepository";

const updateStatWithEndedSession = async (sessionId: string) => {
  const session = await SessionRepository.getBySessionId(sessionId);
  if (!session) {
    logger.warn(
      `${__filename}.${updateStatWithEndedSession.name}: Session not found in DB: ${sessionId}`,
    );
    return;
  }
  const sessionState = session.get("state");
  if (sessionState === "running") {
    logger.warn(
      `${__filename}.${updateStatWithEndedSession.name}: Session is still running: ${sessionId}`,
    );
    return;
  }

  const [participants, reports] = await Promise.all([
    SessionParticipantRepository.getBySessionId(sessionId),
    CheckinReportRepository.getSessionReports(sessionId),
  ]);

  const userStats = await Promise.all(
    participants.map(async (p) => UserStatsRepository.get(p.get("userId"))),
  );

  userStats.forEach((us, i) => {
    const p = participants[i]!.getCommittedState();
    const reviewee_report = reports.find(
      (x) => x.get("revieweeId") === p.userId,
    );
    if (!reviewee_report) {
      logger.error(
        `There's no report for ${p.userId}. Consider the logs and handle this semantic error`,
      );
      return;
    }
    const worked_factor = reviewee_report.get("workProved") ? 1 : 0;

    logger.info(`Updating User Stats for ${p.userId}`);
    us.add("totalSessionCount", 1);

    if (p.state === "disconnected") us.add("disConnectedSessionCount", 1);

    us.add(
      "totalFocusMinutes",
      worked_factor * Math.floor(p.focusTimeSeconds / 60),
    );
    us.add(
      "totalBreakMinutes",
      worked_factor * Math.floor(p.breakTimeSeconds / 60),
    );

    const new_xp = LevelService.calcSessionXp(
      p.focusTimeSeconds,
      p.breakTimeSeconds,
    );
    const { level, xpInLevel, xpToNext } = LevelService.handleXpGain(
      us.get("level"),
      us.get("currentXP"),
      new_xp,
    );
    us.set("level", worked_factor * level);
    us.set("currentXP", worked_factor * xpInLevel);
    us.set("tillNextLevelXP", worked_factor * xpToNext);

    const addedCoins = StoreService.calcSessionCoin(
      p.focusTimeSeconds,
      p.breakTimeSeconds,
    );
    us.add("currentCoins", worked_factor * addedCoins);
  });

  await UserStatsRepository.save(...userStats);
};
const getStatData = async (userId: string): Promise<UserStatsData | null> => {
  const stat = await UserStatsRepository.get(userId);
  return stat ? stat.getCommittedState() : null;
};

export const UserStatService = {
  updateStatWithEndedSession,
  getStatData,
};
