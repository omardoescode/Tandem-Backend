import { Session } from "../entities/Session";
import { PeerMatchingService } from "./PeerMatchingService";
import { SessionRepository } from "../repositories/SessionRepository";
import { v7 } from "uuid";
import { TaskService } from "./TaskService";
import { CheckinService } from "./CheckinService";
import { WebSocketRegistry } from "./WebSocketRegistry";
import { SessionParticipantService } from "./SessionParticipantService";
import { SessionParticipantRepository } from "../repositories/SessionParticipantRepository";
import logger from "@/lib/logger";
import { SessionCacheRegistry } from "./SessionCacheRegistry";

export interface SessionCreation {
  duration: string;
  partners: {
    userId: string;
    tasks: string[];
  }[];
}

const initializeSession = async (data: SessionCreation) => {
  const sessionId = v7();
  const session = new Session(
    {
      scheduledDuration: data.duration,
      sessionId: sessionId,
      startTime: new Date(),
      state: "running",
    },
    { initiallyDirty: true },
  );
  await SessionRepository.save(session);

  await SessionParticipantService.createSessionParticipants(
    sessionId,
    data.partners,
  );

  const tasks_inp = data.partners.flatMap((p) =>
    p.tasks.map((task) => ({
      title: task,
      userId: p.userId,
    })),
  );

  const tasks = await TaskService.createSessionTasks(sessionId, tasks_inp);

  CheckinService.createCheckinTimer(
    sessionId,
    session.get("scheduledDuration"),
  );

  SessionCacheRegistry.addSession(
    sessionId,
    data.partners.map((p) => p.userId),
  );

  data.partners.forEach((u) => {
    WebSocketRegistry.broadcast(u.userId, {
      type: "start_session",
      partners: data.partners
        .filter((x) => x.userId != u.userId)
        .map((u) => ({
          id: u.userId,
          tasks: u.tasks,
        })),
      tasks: tasks
        .filter((t) => t.get("userId") === u.userId)
        .map((t) => ({
          task_id: t.get("taskId"),
          title: t.get("title"),
        })),
      start_time: session.get("startTime").toISOString(),
      scheduled_duration: session.get("scheduledDuration"),
    });
  });
};

const handleDisconnect = async (userId: string) => {
  const found = PeerMatchingService.removeRequest(userId);
  if (found) return;

  const sessionId = SessionCacheRegistry.getUserSessionId(userId);
  if (!sessionId) {
    logger.warn(`User (userId=${userId}) has no active session`);
    return;
  }

  const session = await SessionRepository.getBySessionId(sessionId);
  if (!session) {
    logger.warn(`Session (sessionId=${sessionId}) is not in DB`);
    return;
  }

  const sessionState = session.get("state");

  if (session.get("state") === "finished") return;

  await SessionParticipantService.handleDisconnect(session, userId);

  // TODO: Handle the case if all users disconnected while a session is still mid way
};

const endSession = async (sessionId: string) => {
  const session = await SessionRepository.getBySessionId(sessionId);
  if (!session) {
    logger.warn(`Session (sessionId=${sessionId}) is not in DB`);
    return;
  }

  session.finish();
  await SessionRepository.save(session);
  const participants =
    await SessionParticipantRepository.getBySessionId(sessionId);

  participants.forEach((p) => {
    p.finish();
    const userId = p.get("userId");
    WebSocketRegistry.broadcast(userId, {
      type: "session_done",
    });
    WebSocketRegistry.endUserConnection(userId);
  });

  SessionCacheRegistry.deleteSessionCache(sessionId);
  await SessionParticipantRepository.save(...participants);

  logger.info(`Session is over (sessionId=${sessionId})`);
};

export const SessionService = {
  initializeSession,
  handleDisconnect,
  endSession,
};
