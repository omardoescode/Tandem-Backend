import { v7 } from "uuid";
import { CheckinReport } from "../entities/CheckinReport";
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

const checkinTimers = new Map<string, Timer>();

function createCheckinTimer(sessionId: string, duration: string) {
  const duration_ms = moment.duration(duration).asMilliseconds();

  const timer = setTimeout(() => {
    startCheckin(sessionId).catch(console.error);
  }, duration_ms);

  checkinTimers.set(sessionId, timer);
}

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

  await testSessionOver(sessionId);
}

// TODO: Figure out if a session is over
async function testSessionOver(sessionId: string) {
  const working_participants_count =
    await SessionParticipantRepository.getWorkingSessionParticipantsCount(
      sessionId,
    );
  const full_report_count =
    await CheckinReportRepository.getSessionReportsCount(sessionId);
  console.log(working_participants_count, full_report_count);
  if (working_participants_count === full_report_count)
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

export const CheckinService = {
  handleReport,
  sendMessage,
  createCheckinTimer,
};
