import logger from "@/lib/logger";
import { Entity } from "@/utils/Entity";

export const sessionParticipantStates = [
  "working",
  "complete",
  "disconnected",
] as const;

export type SessionParticipantState = (typeof sessionParticipantStates)[number];

export interface SessionParticipantData {
  userId: string;
  sessionId: string;
  state: SessionParticipantState;
  focusTimeSeconds: number;
  breakTimeSeconds: number;
}

export class SessionParticipant extends Entity<SessionParticipantData> {
  public disconnect() {
    if (this.get("state") === "disconnected") {
      logger.warn(`Participant ${this.get("userId")} is already disconnected`);
      return;
    }

    this.set("state", "disconnected");
  }

  public finish() {
    this.set("state", "complete");
  }
}
