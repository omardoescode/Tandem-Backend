import type { WSContext } from "hono/ws";
import { Actor } from "@/framework/Actor";
import type { SessionWsMessage, SessionWsResponse } from "./validation";
import ActorContext from "../framework/ActorContext";
import type { ActorRef } from "@/framework/ActorRef";
import type { SessionMessage } from "./SessionActor";
import type { MatchingMessage } from "./PeerMatchingActor";
import type { DBClientContext } from "./DBClientActor";
import { v4 as uuid } from "uuid";
import type { TaskContext } from "./TaskActor";
import { ContextInitializationError } from "@/framework/Errors";

export type ConnMessage =
  | {
      type: "WSConnected";
      ws_id: string;
      ws: WSContext;
    }
  | {
      type: "WSDisconnected";
      ws_id: string;
    }
  | { type: "UserSendMessage"; content: SessionWsMessage }
  | { type: "SendUserMessage"; content: SessionWsResponse };

export class ConnActor extends Actor<ConnMessage> {
  private session_ref: ActorRef<SessionMessage> | null = null;
  private connections = new Map<string, WSContext>();

  constructor(
    user_id: string,
    private peer_matching_ref: ActorRef<MatchingMessage>,
    private task_context: TaskContext,
    private client_context: DBClientContext,
  ) {
    super(user_id);
  }

  protected override async handleMessage(msg: ConnMessage): Promise<void> {
    switch (msg.type) {
      case "WSConnected": {
        this.connections.set(msg.ws_id, msg.ws);
        // TODO: Inform this websocket of the progress so far
        break;
      }
      case "WSDisconnected": {
        this.connections.delete(msg.ws_id);
        break;
      }
      case "SendUserMessage": {
        for (const ws of this.connections.values())
          ws.send(JSON.stringify(msg.content));
        break;
      }

      case "UserSendMessage": {
        await this.handleWSMessage(msg.content);
        break;
      }
    }
  }

  private async handleWSMessage(msg: SessionWsMessage) {
    switch (msg.type) {
      case "init_session": {
        this.send({
          type: "SendUserMessage",
          content: {
            type: "matching_pending",
          },
        });
        await this.peer_matching_ref.send({
          type: "MatchRequest",
          duration: msg.focus_duration,
          tasks: msg.tasks,
          user_id: this.id,
          _reply: (match) => {
            if (match) this.session_ref = match;
          },
        });
        break;
      }
      case "checkin_report": {
        if (!this.session_ref) return;
        this.session_ref.send({
          type: "SessionCheckInReport",
          work_proved: msg.work_proved,
          from_id: this.id,
        });
        break;
      }

      case "checkin_message": {
        if (!this.session_ref) return;
        this.session_ref.send({
          type: "UserChatMessage",
          user_id: this.id,
          content: msg.content,
        });
        break;
      }

      case "toggle_task": {
        const client_id = uuid();
        const client = this.client_context.get_ref(client_id);
        await client.send({ type: "Init" });
        const task_actor = this.task_context.get_ref(msg.task_id);
        await task_actor.send({
          type: "Set",
          db_client: client,
          value: msg.is_complete,
          user_id: this.id,
        });
        await client.send({ type: "Commit" });
        await this.client_context.stop(client_id);
        break;
      }
    }
  }
}

export class ConnContext extends ActorContext<ConnMessage> {
  public override actor_category: string = "exists";
  private peer_matching_ref: ActorRef<MatchingMessage> | null = null;
  constructor(
    private task_context: TaskContext,
    private client_context: DBClientContext,
  ) {
    super();
  }

  set_peer_matching_ref(ref: ActorRef<MatchingMessage>) {
    this.peer_matching_ref = ref;
  }

  protected override create_actor(id: string): Actor<ConnMessage> {
    if (!this.peer_matching_ref) throw new ContextInitializationError();

    return new ConnActor(
      id,
      this.peer_matching_ref,
      this.task_context,
      this.client_context,
    );
  }
}
