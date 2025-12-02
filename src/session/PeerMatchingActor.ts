import { Actor } from "@/framework/Actor";
import ActorContext from "../framework/ActorContext";
import type { ActorRef } from "@/framework/ActorRef";
import type { SessionContext, SessionMessage } from "./SessionActor";
import { v7 as uuidv7, v4 } from "uuid";
import { type DBClientContext } from "./DBClientActor";
import type { ConnContext } from "./ConnActor";

export type MatchingMessage =
  | {
      type: "MatchRequest";
      user_id: string;
      duration: string;
      tasks: string[];
      _reply?: (match: ActorRef<SessionMessage> | null) => Promise<void> | void;
    }
  | {
      type: "DisconnectUser";
      user_id: string;
      _reply?: (found: boolean) => Promise<void> | void;
    };

type PeerMatchingClient = {
  user_id: string;
  duration: string;
  tasks: string[];
  _reply?: (match: ActorRef<SessionMessage> | null) => Promise<void> | void;
};

export class PeerMatchingActor extends Actor<MatchingMessage> {
  private waitingClients: Map<string, PeerMatchingClient[]> = new Map();
  private userToDuration: Map<string, string> = new Map();

  constructor(
    id: string,
    private session_ctx: SessionContext,
    private db_client_ctx: DBClientContext,
    private user_ctx: ConnContext,
  ) {
    super(id);
  }

  protected override async handleMessage(
    message: MatchingMessage,
  ): Promise<void> {
    switch (message.type) {
      case "MatchRequest": {
        // Prevent duplicate entry
        if (this.userToDuration.has(message.user_id)) {
          message._reply?.(null);
          return;
        }

        const q = this.get_queue(message.duration);
        const other = q.shift();
        if (other) {
          // Remove the shifted user from the map
          this.userToDuration.delete(other.user_id);
        }

        if (!other) {
          q.push({
            _reply: message._reply,
            duration: message.duration,
            tasks: message.tasks,
            user_id: message.user_id,
          });
          this.userToDuration.set(message.user_id, message.duration);
          message._reply?.(null);
          return;
        }
        // Create a session
        console.log("Creating a session");
        const session = await this.create_session([
          other,
          {
            user_id: message.user_id,
            duration: message.duration,
            tasks: message.tasks,
            _reply: message._reply,
          },
        ]);
        message._reply?.(session);
        other._reply?.(session);
        break;
      }
      case "DisconnectUser": {
        let found = false;
        const duration = this.userToDuration.get(message.user_id);
        if (duration) {
          const queue = this.get_queue(duration);
          const idx = queue.findIndex((cl) => cl.user_id == message.user_id);
          if (idx !== -1) {
            queue.splice(idx, 1);
            this.userToDuration.delete(message.user_id);
            found = true;
          }
        }
        message._reply?.(found);
        break;
      }
    }
  }

  private get_queue(duration: string) {
    let queue = this.waitingClients.get(duration);
    if (!queue) {
      queue = [];
      this.waitingClients.set(duration, queue);
    }
    return queue;
  }

  private async create_session(clients: PeerMatchingClient[]) {
    const client = await this.db_client_ctx.spawn(v4());
    await client.send({ type: "Init" });
    const session = await this.session_ctx.spawn(uuidv7()); // TODO: Make an actor that spawns a db entity, will be great if built like an ORM
    await Promise.all(
      clients.map(async (cl) => {
        const user_ref = this.user_ctx.get_ref(cl.user_id);
        await session.send({
          type: "UserJoin",
          duration: cl.duration,
          user_ref,
          tasks: cl.tasks,
        });
      }),
    );
    await session.send({
      type: "StartSession",
      client,
    });
    await client.send({ type: "Commit" });
    return session;
  }
}

export class PeerMatchingContext extends ActorContext<MatchingMessage> {
  public override actor_category: string = "peer_matching";

  constructor(
    private session_ctx: SessionContext,
    private db_client_ctx: DBClientContext,
    private user_ctx: ConnContext,
  ) {
    super();
  }

  protected override create_actor(id: string): Actor<MatchingMessage> {
    return new PeerMatchingActor(
      id,
      this.session_ctx,
      this.db_client_ctx,
      this.user_ctx,
    );
  }
}
