import { Entity } from "@/utils/Entity";

export interface CheckinReportData {
  reportId: string;
  sessionId: string;
  reviewerId: string;
  revieweeId: string;
  workProved: boolean;
}

export class CheckinReport extends Entity<CheckinReportData> {}
