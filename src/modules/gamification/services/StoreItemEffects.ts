import logger from "@/lib/logger";
import assert from "assert";
import { UserStatsRepository } from "../repositories/UserStatsRepository";
import { SessionRepository } from "@/modules/session/repositories/SessionRepository";
import { SessionParticipantRepository } from "@/modules/session/repositories/SessionParticipantRepository";

const effects = new Map<string, (userId: string) => Promise<null | string>>();

effects.set("restore_last_unverified_session", async (userId: string) => {
  const [us, session] = await Promise.all([
    UserStatsRepository.get(userId),
    SessionRepository.getLastDisconnectedSession(userId),
  ]);
  if (!session) return "You have no disconnected sessions";

  const p = await SessionParticipantRepository.getByUserIdAndSessionId(
    userId,
    session.get("sessionId"),
  );
  assert(p);

  us.applySessionEffect(p, true);
  await UserStatsRepository.save(us);
  return null;
});

export const StoreItemEffects = {
  applyItem: async (userId: string, itemId: string): Promise<null | string> => {
    const effect = effects.get(itemId);
    if (!effect) {
      logger.warn(`Item ${itemId} doesn't apply here`);
      return "Unavailable effect";
    }

    return await effect(userId);
  },
};
