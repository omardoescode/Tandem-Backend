import type { Client } from "@/types";
import { Actor, type ActorMessage } from "./Actor";
import ActorContext from "./ActorContext";
import { ExecuteMessage, type DBClientMessage } from "@/session/DBClientActor";
import type { ActorRef } from "./ActorRef";

export type PersistenceMessage =
  | {
      type: "persist";
      client: ActorRef<DBClientMessage>;
    }
  | {
      type: "recover";
      client: ActorRef<DBClientMessage>;
      _reply?: (result: boolean) => Promise<void> | void;
    };

export interface BaseState {
  id: string;
}

export abstract class PersistantActor<
  MessageType extends ActorMessage,
  InternalState extends BaseState,
> extends Actor<MessageType | PersistenceMessage> {
  state: InternalState | null = null;

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
        if (!this.state) return;
        await msg.client.send(ExecuteMessage(ctx.methods.persist, this.state));
        break;
      }
      case "recover":
        this.state = await msg.client.ask<InternalState>(
          ExecuteMessage(ctx.methods.get, { id: this.id }),
        );
        msg._reply?.(!!this.state);
        break;
    }
  }
}

type Nullable<T> = {
  [K in keyof T]: T[K] | null;
};

interface RepoMethods<InternalState extends BaseState> {
  delete?: (client: Client, args: { id: string }) => Promise<boolean>;
  get: (client: Client, args: { id: string }) => Promise<InternalState | null>;
  persist: (
    client: Client,
    args: {
      id: string;
    } & Nullable<InternalState>,
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
