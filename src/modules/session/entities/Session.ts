import logger from "@/lib/logger";
import { Entity } from "@/utils/Entity";

export const sessionStates = [
  "disconnected",
  "running",
  "checkin",
  "finished",
] as const;

export type SessionState = (typeof sessionStates)[number];

interface SessionData {
  sessionId: string;
  startTime: Date;
  scheduledDuration: string;
  state: SessionState;
}

export class Session extends Entity<SessionData> {
  public startCheckin() {
    const current_state = this.get("state");
    if (current_state !== "running") {
      logger.warn(
        `Ignoring transition to checkin from invalid state: ${current_state}`,
      );
      return;
    }

    this.set("state", "checkin");
  }

  public finish() {
    const current_state = this.get("state");
    if (current_state !== "checkin") {
      logger.warn(
        `Ignoring transition to checkin from invalid state: ${current_state}`,
      );
      return;
    }

    this.set("state", "finished");
  }

  public disconnect() {
    this.set("state", "disconnected");
  }
}
