import { v7 } from "uuid";
import {
  CheckinReport,
  type CheckinReportData,
} from "../entities/CheckinReport";
import { CheckinReportRepository } from "../repositories/CheckinReportRepository";
import { CheckinMessage } from "../entities/CheckinMessage";
import { CheckinMessageRepository } from "../repositories/CheckinMessageRepository";
import moment from "moment";
import { SessionService } from "./SessionService";
import { SessionParticipantRepository } from "../repositories/SessionParticipantRepository";
import logger from "@/lib/logger";
import { SessionRepository } from "../repositories/SessionRepository";
import { WebSocketRegistry } from "./WebSocketRegistry";
import { SessionCacheRegistry } from "./SessionCacheRegistry";

const checkinTimers = new Map<string, NodeJS.Timeout>();

function createCheckinTimer(sessionId: string, duration: string) {
  const duration_ms = moment.duration(duration).asMilliseconds();

  const timer = setTimeout(() => {
    startCheckin(sessionId).catch(console.error);
  }, duration_ms);

  checkinTimers.set(sessionId, timer);
}

// TODO: In case of starting a checkin with only one user, auto generate a checkin report with user as reviewer and reviewee (self-checkin). Only consider if the other gets disconnected before giving a report
async function startCheckin(sessionId: string) {
  logger.info(`Beginning Checkin for session (sessionId=${sessionId})`);

  const session = await SessionRepository.getBySessionId(sessionId);
  if (!session) {
    logger.warn(
      `Starting checking for non existent session (sessionId=${sessionId})`,
    );
    return;
  }

  session.startCheckin();
  await SessionRepository.save(session);

  const participants =
    await SessionParticipantRepository.getBySessionId(sessionId);

  SessionCacheRegistry.moveToCheckin(sessionId);

  participants.forEach((p) => {
    WebSocketRegistry.broadcast(p.get("userId"), {
      type: "checkin_start",
    });
  });
}

async function handleReport(
  sessionId: string,
  from: string,
  to: string,
  workProved: boolean,
) {
  const reportId = v7();
  const report = new CheckinReport(
    {
      reportId,
      revieweeId: to,
      reviewerId: from,
      workProved,
      sessionId,
    },
    { initiallyDirty: true },
  );
  await CheckinReportRepository.save(report);

  SessionCacheRegistry.report(from);
  await testSessionOver(sessionId);
}

async function testSessionOver(sessionId: string) {
  const sessionCache = SessionCacheRegistry.getSession(sessionId);
  if (!sessionCache) {
    logger.warn(`Session is not in cache: ${sessionId}`);
    return;
  }
  if (!sessionCache.participants.some((p) => !p.reported))
    await SessionService.endSession(sessionId);
}

// TODO: Handle image upload and audio upload too
async function sendMessage(
  sessionId: string,
  lastOrdering: number,
  content: string,
) {
  const messageId = v7();
  const msg = new CheckinMessage(
    { messageId, sessionId, content, orderingSeq: lastOrdering + 1 },
    { initiallyDirty: true },
  );
  await CheckinMessageRepository.save(msg);
}

async function getRevieweeReportsData(
  userId: string,
): Promise<Omit<CheckinReportData, "reportId">[]> {
  const reports = await CheckinReportRepository.getRevieweeReports(userId);
  return reports.map((r) => {
    const { reportId: _, ...rest } = r.getCommittedState();
    return rest;
  });
}

async function selfCheckin(sessionId: string, userId: string) {
  const session = SessionCacheRegistry.getSession(sessionId);
  if (!session) return;

  if (session.participants.filter((x) => x.connected).length !== 1) {
    WebSocketRegistry.broadcast(userId, { type: "self_checkin_refused" });
    return;
  }

  const report = new CheckinReport(
    {
      sessionId,
      reportId: v7(),
      revieweeId: userId,
      reviewerId: userId,
      workProved: true,
    },
    { initiallyDirty: true },
  );
  await CheckinReportRepository.save(report);

  WebSocketRegistry.broadcast(userId, { type: "self_checkin_done" });
  await SessionService.endSession(sessionId);
  return;
}

export const CheckinService = {
  handleReport,
  sendMessage,
  createCheckinTimer,
  getRevieweeReportsData,
  selfCheckin,
};
