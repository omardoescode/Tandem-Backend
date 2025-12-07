import logger from "@/lib/logger";
import { Entity } from "@/utils/Entity";
import moment from "moment";

export const sessionParticipantStates = [
  "working",
  "complete",
  "disconnected",
  "on_break",
] as const;

export type SessionParticipantState = (typeof sessionParticipantStates)[number];

export interface SessionParticipantData {
  userId: string;
  sessionId: string;
  state: SessionParticipantState;
  focusTimeSeconds: number;
  breakTimeSeconds: number;
  updatedAt?: Date; // undefined, because I don't need to assign it on first time
}

export class SessionParticipant extends Entity<SessionParticipantData> {
  public disconnect() {
    if (this.get("state") === "disconnected") {
      logger.warn(`Participant ${this.get("userId")} is already disconnected`);
      return;
    }

    this.updateTime();
    this.set("state", "disconnected");
  }

  public finish() {
    this.updateTime();
    this.set("state", "complete");
  }

  public break() {
    if (this.get("state") === "complete") {
      logger.warn(
        `Participant ${this.get("userId")} has finished sessoin (sessionId=${this.get("sessionId")})`,
      );
      return;
    }

    this.updateTime();
    this.set("state", "on_break");
  }

  public work() {
    if (this.get("state") === "complete") {
      logger.warn(
        `Participant ${this.get("userId")} has finished sessoin (sessionId=${this.get("sessionId")})`,
      );
      return;
    }
    this.updateTime();
    this.set("state", "on_break");
  }

  public updateTime() {
    const updatedAt = this.get("updatedAt");
    if (!updatedAt) return;

    const seconds = Math.floor(
      moment.duration(moment().diff(moment(updatedAt))).asSeconds(),
    );

    const state = this.get("state");

    if (state === "working")
      this.set("focusTimeSeconds", this.get("focusTimeSeconds") + seconds);
    else if (state === "on_break")
      this.set("breakTimeSeconds", this.get("breakTimeSeconds") + seconds);
  }
}
