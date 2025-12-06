import { Actor, type ActorMessage } from "./Actor";
import ActorContext from "./ActorContext";
import type { Client } from "@/types";

export type PersistenceMessage =
  | {
      type: "persist";
      client: Client;
    }
  | {
      type: "recover";
      client: Client;
      _reply?: (result: boolean) => Promise<void> | void;
    };

export interface BaseState {
  id: string;
}

export abstract class PersistantActor<
  MessageType extends ActorMessage,
  InternalState extends BaseState,
> extends Actor<MessageType | PersistenceMessage> {
  protected state: InternalState | null = null;
  protected to_update: Partial<InternalState> = {};

  constructor(
    id: string,
    context: PersistentContext<MessageType, InternalState>,
  ) {
    super(context, id);
  }

  protected override async handleMessage(
    message: MessageType | PersistenceMessage,
  ): Promise<void> {
    const ctx = this.context as PersistentContext<MessageType, InternalState>;
    const msg = message as PersistenceMessage;
    switch (msg.type) {
      case "persist": {
        if (!this.to_update) return;
        await ctx.methods.persist(msg.client, {
          ...this.to_update,
          id: this.id,
        });
        break;
      }
      case "recover":
        this.state = await ctx.methods.get(msg.client, { id: this.id });
        this.to_update = {};
        msg._reply?.(!!this.state);
        break;
    }
  }
}

interface RepoMethods<InternalState extends BaseState> {
  delete?: (client: Client, args: { id: string }) => Promise<boolean>;
  get: (client: Client, args: { id: string }) => Promise<InternalState | null>;
  persist: (
    client: Client,
    args: {
      id: string;
    } & Partial<InternalState>,
  ) => Promise<void>;
}

export abstract class PersistentContext<
  MessageType extends ActorMessage,
  InternalState extends BaseState,
> extends ActorContext<MessageType | PersistenceMessage> {
  constructor(public methods: RepoMethods<InternalState>) {
    super();
  }
}
