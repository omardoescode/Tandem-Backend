// ref: https://www.xjavascript.com/blog/typescript-actor-model/

import type { UnionOmit } from "@/types";
import { v4 as uuid } from "uuid";
import { AskTimeout } from "./Errors";
import type ActorContext from "./ActorContext";

export interface ActorMessage {
  type: `${string}`;
}

export type AskMessage<Msg extends ActorMessage> = UnionOmit<Msg, "_reply">;

export abstract class Actor<MessageType extends ActorMessage> {
  public readonly id: string;
  private mailbox: MessageType[] = [];
  private running: boolean = false;
  private processing: boolean = false;

  constructor(
    protected context: ActorContext<MessageType>,
    id?: string,
  ) {
    this.id = id ?? uuid();
  }

  public send(message: MessageType) {
    this.mailbox.push(message);
    this.schedule();
  }

  public async ask<ReplyType>(
    message: AskMessage<MessageType>,
    timeout_ms: number = 5000,
  ): Promise<ReplyType> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new AskTimeout()), timeout_ms);

      const messageWithReply = {
        ...message,
        _reply: (reply: ReplyType) => {
          clearTimeout(timeout);
          resolve(reply);
        },
      };

      this.send(messageWithReply as MessageType);
    });
  }

  public start() {
    this.running = true;
    this.schedule();
  }

  public stop() {
    this.running = false;
  }

  private async processMessages() {
    while (this.mailbox.length > 0 && this.running) {
      if (this.mailbox.length > 0) {
        const message = this.mailbox.shift();
        if (message) await this.handleMessage(message);
      }

      // Yield control to the event loop so other tasks can run
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    this.processing = false;
  }

  private schedule() {
    if (this.processing || !this.running) return;

    this.processing = true;

    setTimeout(() => this.processMessages(), 0);
  }

  /**
   * NOTE: Errors should be handled gracefully within this method
   */
  protected abstract handleMessage(message: MessageType): Promise<void>;
}
