/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PoolClient } from "pg";
import { Actor } from "@/framework/Actor";
import pool from "@/db/pool";
import ActorContext from "@/framework/ActorContext";
import { type Client } from "@/types";

export type DBClientMessage =
  | { type: "Init" }
  | { type: "Release" }
  | { type: "Commit" }
  | { type: "Rollback" }
  | {
      type: "Execute";
      fn: (client: Client, arg: any) => Promise<unknown>;
      arg: any;
      _reply?: (result: any) => void | Promise<void>;
    };

export function ExecuteMessage<
  F extends (client: Client, arg: any) => Promise<any> | any,
>(
  fn: F,
  arg: Parameters<F>[1],
  _reply?: (result: Awaited<ReturnType<F>>) => Promise<void> | void,
): DBClientMessage {
  return {
    type: "Execute",
    fn,
    arg,
    _reply,
  };
}

export class DBClientActor extends Actor<DBClientMessage> {
  private client: PoolClient | null = null;
  constructor(id: string, context: ActorContext<DBClientMessage>) {
    super(context, id);
  }

  protected override async handleMessage(
    message: DBClientMessage,
  ): Promise<void> {
    switch (message.type) {
      case "Init":
        if (this.client) return;
        this.client = await pool.connect();
        await this.client.query("begin");
        console.log("Initialization");
        break;

      case "Execute":
        {
          if (!this.client) {
            return; // TODO: Warn about the wrong execution of this

            // TODO: I think in case o fan error, an actor should throw an error, but the process should just stop this, and waiting to manual restart??
          }
          console.log("Execution");
          const result = await message.fn(this.client, message.arg);
          message._reply?.(result);
        }
        break;

      case "Release":
        if (this.client) this.client.release();
        break;

      case "Commit":
        if (!this.client) {
          return;
        }

        console.log("Commit");
        console.log("About to commit");
        await this.client.query("commit");
        console.log("this committed");
        break;

      case "Rollback":
        if (!this.client) {
          return;
        }

        await this.client.query("rollback");
        break;
    }
  }
}

export class DBClientContext extends ActorContext<DBClientMessage> {
  public override actor_category: string = "db_client";
  protected override create_actor(id: string): Actor<DBClientMessage> {
    return new DBClientActor(id);
  }
}
