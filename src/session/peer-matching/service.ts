import type Option from "@/utils/monads/Option";
import type { PeerMatchingClient } from "./types";
import { None, Some } from "@/utils/monads/Option";

export default class PeerMatchingService {
  private static _instance: PeerMatchingService;
  private waitingClients: Map<string, PeerMatchingClient[]> = new Map();

  public static instance(): PeerMatchingService {
    if (!PeerMatchingService._instance) {
      PeerMatchingService._instance = new PeerMatchingService();
    }
    return PeerMatchingService._instance;
  }
  private constructor() {}

  public match(cl: PeerMatchingClient): Option<PeerMatchingClient> {
    let queue = this.waitingClients.get(cl.duration);

    if (!queue) {
      queue = [];
      this.waitingClients.set(cl.duration, queue);
    }

    if (queue.length === 0) {
      queue.push(cl);
      return None();
    } else {
      const other = queue[0]!;
      queue.shift();
      return Some(other);
    }
  }

  public disconnectClient(user_id: string): boolean {
    for (const entry of this.waitingClients) {
      const queue = entry[1];
      const idx = queue.findIndex((cl) => cl.user_id == user_id);
      if (idx != -1) {
        delete queue[idx];
        return true;
      }
    }
    return false;
  }
}
