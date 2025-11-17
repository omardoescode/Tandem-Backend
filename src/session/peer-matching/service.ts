import type { WSContext } from "hono/ws";
import type { PeerMatchingClient } from "./types";

export default class PeerMatchingService {
  private static _instance: PeerMatchingService;
  private waitingClients: Map<number, PeerMatchingClient[]> = new Map();

  public static instance(): PeerMatchingService {
    if (!PeerMatchingService._instance) {
      PeerMatchingService._instance = new PeerMatchingService();
    }
    return PeerMatchingService._instance;
  }
  private constructor() {}

  public match(cl: PeerMatchingClient): PeerMatchingClient | null {
    let queue = this.waitingClients.get(cl.timer_seconds);

    if (!queue) {
      queue = [];
      this.waitingClients.set(cl.timer_seconds, queue);
    }

    if (queue.length === 0) {
      queue.push(cl);
      return null;
    } else {
      const other = queue[0]!;
      return other;
    }
  }
}
