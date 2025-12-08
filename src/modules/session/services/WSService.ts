import type { User } from "@/modules/auth/User";
import type { SessionWsMessage } from "../validation";
import { SessionCacheRegistry } from "./SessionCacheRegistry";
import { WebSocketRegistry } from "./WebSocketRegistry";
import { PeerMatchingService } from "./PeerMatchingService";
import { TaskService } from "./TaskService";
import { logger } from "better-auth";
import { CheckinService } from "./CheckinService";
import { SessionParticipantRepository } from "../repositories/SessionParticipantRepository";
import { SessionService } from "./SessionService";

// Handle reconnection if any
const handleReconnct = async (user: User) => {
  const userId = user.get("id");
  const session = SessionCacheRegistry.getUserSession(userId);
  if (!session) return;

  await SessionService.rejoinSession(userId, session.sessionId);
};

// TODO: Check for expected session state before proceeding, or for existence of session
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

      WebSocketRegistry.broadcast(message.reviewee_id, {
        type: "checkin_report_sent",
        work_proved: message.work_proved,
      });

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

      const session_participants =
        await SessionParticipantRepository.getBySessionId(session.sessionId);

      await CheckinService.sendMessage(
        session.sessionId,
        message.last_ordering,
        message.content,
      );

      session_participants.forEach((u) => {
        const recepientId = u.get("userId");
        if (recepientId != userId)
          WebSocketRegistry.broadcast(u.get("userId"), {
            type: "checkin_partner_message",
            content: message.content,
            from: userId,
          });
      });
      return;
  }

  throw new Error("Unimplemented");
};
export const WSService = { handleMessage, handleReconnect: handleReconnct };
