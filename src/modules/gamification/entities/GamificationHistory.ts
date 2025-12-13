import { Entity } from "@/utils/Entity";

export type GamificationEventType = "ended session" | "purchase item" | "achieved";

export interface GamificationHistoryState {
  userId: string;
  type: GamificationEventType;
  added_coins?: number;
  added_xp?: number;
  sessionId?: string;
  purchased?: string;
  achieved?: string;
}

export class GamificationHistory extends Entity<GamificationHistoryState> {
  constructor(state: GamificationHistoryState) {
    super(state);
  }
}
