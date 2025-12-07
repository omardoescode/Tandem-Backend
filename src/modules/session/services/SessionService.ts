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
  // TODO: Inform other participants that the user has disconnected??

  const session_cache = SessionCacheRegistry.getUserSession(userId);
  assert(session_cache);

  if (!session_cache.participants.some((p) => p.connected)) {
    session.disconnect();
    await SessionRepository.save(session);
    logger.info(`Session disconnected (sessionId=${session.get("sessionId")})`);

    // TODO: Save this also in cache with a timer for a duration equal to user disconnection duration. If not re-connected, go back to its former state, if not, go back
    // TODO: Consider the case if a session is disconnected, but a checkin timer still exists
    // NOTE: I think the solution is omitting disconnection out of the state to make it a linear process
  }
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

const rejoinSession = async (userId: string, sessionId: string) => {
  SessionParticipantService.reconnect(userId);
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
    .map((t) => ({
      task_id: t.get("taskId"),
      title: t.get("title"),
    }));

  const timeLeft =
    sessionStatus === "running"
      ? moment(startTime).add(moment.duration(scheduledDuration)).toISOString()
      : undefined;

  WebSocketRegistry.broadcast(userId, {
    type: "session_data",
    session_status: sessionStatus,
    time_left: timeLeft,
    partners,
    tasks: userTasks,
    start_time: startTime.toISOString(),
  });
};

export const SessionService = {
  initializeSession,
  handleDisconnect,
  endSession,
  rejoinSession,
};
