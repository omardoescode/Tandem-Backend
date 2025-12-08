import type { User } from "@/modules/auth/User";
import type { SessionWsMessage } from "../validation";
import { SessionCacheRegistry } from "./SessionCacheRegistry";
import { WebSocketRegistry } from "./WebSocketRegistry";
import { PeerMatchingService } from "./PeerMatchingService";
import { TaskService } from "./TaskService";
import { logger } from "better-auth";
import { CheckinService } from "./CheckinService";
import { SessionService } from "./SessionService";

// Handle reconnection if any
const handleReconnct = async (user: User) => {
  const userId = user.get("id");
  const session = SessionCacheRegistry.getUserSession(userId);
  if (!session) return;

  await SessionService.rejoinSession(userId, session.sessionId);
};

const handleMessage = async (message: SessionWsMessage, user: User) => {
  const userId = user.get("id");
  switch (message.type) {
    case "init_session":
      if (SessionCacheRegistry.getUserSession(userId)) {
        WebSocketRegistry.broadcast(userId, {
          type: "already_in_session",
        });
        return;
      }
      const added = PeerMatchingService.addMatchingRequest({
        duration: message.focus_duration,
        tasks: message.tasks,
        userId,
      }); // TODO: Should I prompt the user
      return;
    case "toggle_task":
      const toggled = await TaskService.toggleTask(
        userId,
        message.task_id,
        message.is_complete,
      );
      return;
    // TODO: Make sure that a user cannot checkin with themselves, and must checkin for a user that hasn't been checked in yet
    case "checkin_report": {
      const session = SessionCacheRegistry.getUserSession(userId);
      if (!session) {
        logger.warn(
          `Session entry not found in cache for User(userId=${userId})`,
        );
        return;
      }

      if (session.state !== "checkin") {
        logger.warn(
          `Invalid message from user (userId=${userId}). Session not in checkin phase (sessionId=${session.sessionId})`,
        );
        return;
      }

      const reviewerId = userId;
      await CheckinService.handleReport(
        session.sessionId,
        reviewerId,
        message.reviewee_id,
        message.work_proved,
      );

      return;
    }
    case "checkin_message":
      const session = SessionCacheRegistry.getUserSession(userId);
      if (!session) {
        logger.warn(
          `Session entry not found in cache for User(userId=${userId})`,
        );
        return;
      }

      if (session.state !== "checkin") {
        logger.warn(
          `Invalid message from user (userId=${userId}). Session not in checkin phase (sessionId=${session.sessionId})`,
        );
        return;
      }

      await CheckinService.sendMessage(
        session.sessionId,
        userId,
        message.last_ordering,
        message.content,
      );

      return;
    case "self_checkin":
      {
        const session = SessionCacheRegistry.getUserSession(userId);
        if (!session) {
          logger.warn(
            `Session entry not found in cache for User(userId=${userId})`,
          );
          return;
        }

        if (session.state !== "checkin") {
          logger.warn(
            `Invalid message from user (userId=${userId}). Session not in checkin phase (sessionId=${session.sessionId})`,
          );
          return;
        }
        await CheckinService.selfCheckin(session.sessionId, userId);
      }
      return;
  }

  throw new Error("Unimplemented");
};
export const WSService = { handleMessage, handleReconnect: handleReconnct };
