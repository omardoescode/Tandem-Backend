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
    const p = participants[i]!;
    const reviewee_report = reports.find(
      (x) => x.get("revieweeId") === p.get("userId"),
    );
    if (!reviewee_report) {
      logger.error(
        `There's no report for ${p.get("userId")}. Consider the logs and handle this semantic error`,
      );
      return;
    }

    us.applySessionEffect(p, reviewee_report.get("workProved"));
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
