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
import assert from "assert";
import { TaskRepository } from "../repositories/TaskRepository";
import moment from "moment";
import { UserStatService } from "@/modules/gamification/services/UserStatService";

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
  if (!sessionId) return; // Must be in checkin phase

  const session = await SessionRepository.getBySessionId(sessionId);
  if (!session) {
    logger.warn(`Session (sessionId=${sessionId}) is not in DB`);
    return;
  }

  const sessionState = session.get("state");

  if (sessionState === "finished") return;

  await SessionParticipantService.handleDisconnect(session, userId);

  await WebSocketRegistry.broadcastToSession(sessionId, {
    type: "other_user_disconnected",
    userId,
  });
};

const endSession = async (sessionId: string, connected: boolean = true) => {
  const session = await SessionRepository.getBySessionId(sessionId);
  if (!session) {
    logger.warn(`Session (sessionId=${sessionId}) is not in DB`);
    return;
  }

  if (connected) session.finish();
  else session.disconnect();

  await SessionRepository.save(session);
  const participants =
    await SessionParticipantRepository.getBySessionId(sessionId);

  participants.forEach((p) => {
    if (connected) p.finish();
    else {
    } // Already disconnected earlier, which led to this case

    const userId = p.get("userId");
    WebSocketRegistry.broadcast(userId, { type: "session_done" });
    WebSocketRegistry.endUserConnection(userId);
  });

  SessionCacheRegistry.deleteSessionCache(sessionId);
  await SessionParticipantRepository.save(...participants);

  logger.info(`Session is over (sessionId=${sessionId})`);

  UserStatService.updateStatWithEndedSession(sessionId);
};

const rejoinSession = async (userId: string, sessionId: string) => {
  const reconnected = SessionParticipantService.reconnect(userId);
  if (!reconnected) return;
  const session = await SessionRepository.getBySessionId(sessionId);
  if (!session) {
    logger.warn(
      `Failed to rejoin session (sessionId=${sessionId}, userId=${userId})`,
    );
    return;
  }

  const [participants, tasks] = await Promise.all([
    SessionParticipantRepository.getBySessionId(sessionId),
    TaskRepository.getBySessionId(sessionId),
  ]);

  const sessionStatus =
    session.get("state") === "running" ? "running" : "checkin";

  const startTime = session.get("startTime");
  const scheduledDuration = session.get("scheduledDuration");

  const partners = participants
    .filter((p) => p.get("userId") !== userId)
    .map((p) => ({
      id: p.get("userId"),
      tasks: tasks
        .filter((t) => t.get("userId") === p.get("userId"))
        .map((t) => t.get("title")),
    }));

  const userTasks = tasks
    .filter((t) => t.get("userId") === userId)
    .map((t) => ({ task_id: t.get("taskId"), title: t.get("title") }));

  const timeLeft =
    sessionStatus === "running"
      ? moment(startTime).add(moment.duration(scheduledDuration)).toISOString()
      : undefined;

  await WebSocketRegistry.broadcast(userId, {
    type: "session_data",
    session_status: sessionStatus,
    time_left: timeLeft,
    partners,
    tasks: userTasks,
    start_time: startTime.toISOString(),
  });

  await WebSocketRegistry.broadcastToOthers(userId, {
    type: "other_user_reconnected",
    userId: userId,
    tasks: userTasks.map((t) => t.title),
  });
};

const canReturn = async (userId: string) => {
  return SessionCacheRegistry.hasUser(userId);
};

export const SessionService = {
  initializeSession,
  handleDisconnect,
  endSession,
  rejoinSession,
  canReturn,
};
