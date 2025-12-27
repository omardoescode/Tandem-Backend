import logger from "@/lib/logger";
import { SessionService, type SessionCreation } from "./SessionService";
import { WebSocketRegistry } from "./WebSocketRegistry";

export type MatchingRequest = {
  userId: string;
  tasks: string[];
  duration: string;
  // preferences
};

type MatchingRequestState = Omit<MatchingRequest, "duration"> & {
  minimum_score: number; // NOTE: This will be used later to help with matching
};

const requests = new Map<string, MatchingRequestState[]>();
const exists = new Map<string, string>();

const matching_run = () => {
  setInterval(() => {
    try {
      const matchings: SessionCreation[] = [];

      for (const entry of requests.entries()) {
        const [duration, queue] = entry;
        while (queue.length >= 2) {
          const users = [queue.shift()!, queue.shift()!];
          const matching = {
            partners: users.map((u) => ({
              userId: u.userId,
              tasks: u.tasks,
            })),
            duration,
          };
          matchings.push(matching);
          users.forEach((u) => exists.delete(u.userId));
        }
        requests.set(duration, queue);

        if (queue.length === 0) requests.delete(duration);
      }

      matchings.forEach((matching) => {
        logger.info(`Matching ${matching.partners.map((p) => p.userId)}`);
        SessionService.initializeSession(matching);
      });
    } catch (err: any) {
      console.error(err);
    }
  }, 1000);
};
matching_run();

export const PeerMatchingService = {
  addMatchingRequest(request: MatchingRequest): boolean {
    if (exists.has(request.userId)) {
      logger.info(
        `Matching Request already received: user_id=${request.userId}`,
      );
      return false;
    }
    const { duration, ...rest } = request;
    const queue = requests.get(duration) ?? [];
    queue.push({ ...rest, minimum_score: 1 });
    exists.set(request.userId, request.duration);
    logger.info(
      `Matching Request received: user_id=${request.userId}, duration=${request.duration}`,
    );

    requests.set(request.duration, queue);
    WebSocketRegistry.broadcast(request.userId, {
      type: "matching_pending",
    });
    return true;
  },

  removeRequest(userId: string): boolean {
    const duration = exists.get(userId);
    if (duration === undefined) return false;

    const queue = requests.get(duration);
    if (!queue) return false;

    const idx = queue.findIndex((f) => f.userId === userId);
    if (idx === -1) return false;

    queue.splice(idx, 1);
    if (queue.length === 0) requests.delete(duration);
    
    // Clean up exists map so user can match again
    exists.delete(userId);

    return true;
  },
};
