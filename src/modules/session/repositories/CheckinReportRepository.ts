import { db } from "@/db";
import { CheckinReport } from "../entities/CheckinReport";
import { CheckinReportTable } from "@/db/schemas/session";
import { eq, sql } from "drizzle-orm";

export interface ICheckinReportRepository {
  getRevieweeReports(
    sessionId: string,
    revieweeId: string,
  ): Promise<CheckinReport | null>;

  save(...reports: CheckinReport[]): Promise<void>;

  getSessionReports(sessionId: string): Promise<CheckinReport[]>;
  getSessionReportsCount(sessionId: string): Promise<number>;
}

export const CheckinReportRepository: ICheckinReportRepository = {
  getRevieweeReports: function (
    sessionId: string,
    revieweeId: string,
  ): Promise<CheckinReport | null> {
    throw new Error("Function not implemented.");
  },

  save: async (...reports: CheckinReport[]): Promise<void> => {
    await Promise.all(
      reports.map(async (report) => {
        if (!report.isDirty()) return;
        const changes = report.getChanges();
        await db
          .insert(CheckinReportTable)
          .values({
            ...report.getCommittedState(),
            ...report.getChanges(),
          })
          .onConflictDoUpdate({
            target: CheckinReportTable.reportId,
            set: changes,
          });
        report.commit();
      }),
    );
  },
  getSessionReports: async (sessionId: string): Promise<CheckinReport[]> => {
    const results = await db
      .select()
      .from(CheckinReportTable)
      .where(eq(CheckinReportTable.sessionId, sessionId));

    return results.map((x) => new CheckinReport(x));
  },

  getSessionReportsCount: async (sessionId: string): Promise<number> => {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(CheckinReportTable)
      .where(eq(CheckinReportTable.sessionId, sessionId));

    return result[0]?.count ?? 0;
  },
};
