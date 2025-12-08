import { Entity } from "@/utils/Entity";

export interface CheckinMessageData {
  messageId: string;
  sessionId: string;
  userId: string;
  content?: string | null;
  image_url?: string | null;
  audio_url?: string | null;
  orderingSeq: number;
}

export class CheckinMessage extends Entity<CheckinMessageData> {}
