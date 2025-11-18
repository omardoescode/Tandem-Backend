import type { Duration } from "../validation";

export type PeerMatchingClient = {
  user_id: string;
  duration: Duration;
  tasks: string[];
};
