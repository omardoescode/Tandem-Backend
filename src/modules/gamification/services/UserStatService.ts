import logger from "@/lib/logger";
import { SessionParticipantRepository } from "@/modules/session/repositories/SessionParticipantRepository";
import { UserStatsRepository } from "../repositories/UserStatsRepository";
import { LevelService } from "./LevelService";
import { StoreService } from "./StoreService";
import { SessionRepository } from "@/modules/session/repositories/SessionRepository";

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

  const participants =
    await SessionParticipantRepository.getBySessionId(sessionId);

  const userStats = await Promise.all(
    participants.map(async (p) => UserStatsRepository.get(p.get("userId"))),
  );

  userStats.forEach((us, i) => {
    const p = participants[i]!.getCommittedState();
    logger.info(`Updating User Stats for ${p.userId}`);
    us.add("totalSessionCount", 1);

    if (p.state === "disconnected") us.add("disConnectedSessionCount", 1);

    us.add("totalFocusMinutes", p.focusTimeSeconds);
    us.add("totalBreakMinutes", p.breakTimeSeconds);

    const new_xp = LevelService.calcSessionXp(
      p.focusTimeSeconds,
      p.breakTimeSeconds,
    );
    const { level, xpInLevel, xpToNext } = LevelService.handleXpGain(
      us.get("level"),
      us.get("currentXP"),
      new_xp,
    );
    us.set("level", level);
    us.set("currentXP", xpInLevel);
    us.set("tillNextLevelXP", xpToNext);

    const addedCoins = StoreService.calcSessionCoin(
      p.focusTimeSeconds,
      p.breakTimeSeconds,
    );
    us.add("currentCoins", addedCoins);
  });

  await UserStatsRepository.save(...userStats);
};

export const UserStatService = {
  updateStatWithEndedSession,
};
