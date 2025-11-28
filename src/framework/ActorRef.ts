import type { ActorMessage, AskMessage } from "./Actor";
import type ActorContext from "./ActorContext";

export class ActorRef<MessageType extends ActorMessage> {
  public readonly id: string;
  constructor(
    private context: ActorContext<MessageType>,
    id: string,
  ) {
    this.id = id;
  }

  public async send(message: MessageType): Promise<void> {
    const ref = await this.context.get_actor(this.id);
    ref.send(message);
  }

  public async ask<ReplyType>(
    message: AskMessage<MessageType>,
    timeout_ms: number = 5000,
  ): Promise<ReplyType> {
    const ref = await this.context.get_actor(this.id);
    return await ref.ask<ReplyType>(message, timeout_ms);
  }

  // Get ref from same context to the same or different actor
  public with_entity_id(newId: string): ActorRef<MessageType> {
    return new ActorRef(this.context, newId);
  }
}
