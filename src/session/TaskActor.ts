import { createSessionTask, toggleSessionTask } from "db/tandem_sessions_sql";
import { Actor } from "@/framework/Actor";
import { ExecuteMessage, type DBClientMessage } from "./DBClientActor";
import type { ActorRef } from "@/framework/ActorRef";
import ActorContext from "@/framework/ActorContext";

export type TaskMessage =
  | {
      type: "Set";
      value: boolean;
      db_client: ActorRef<DBClientMessage>;
      user_id: string;
    }
  | {
      type: "Create";
      task: string;
      user_id: string;
      session_id: string;
      db_client: ActorRef<DBClientMessage>;
    };

export class TaskActor extends Actor<TaskMessage> {
  constructor(id: string, context: ActorContext<TaskMessage>) {
    super(context, id);
  }

  protected override async handleMessage(message: TaskMessage): Promise<void> {
    switch (message.type) {
      case "Create": {
        message.db_client.send(
          ExecuteMessage(createSessionTask, {
            taskId: this.id,
            sessionId: message.session_id,
            userId: message.user_id,
            title: message.task,
          }),
        );
        break;
      }
      case "Set": {
        console.log("In set command");
        message.db_client.send(
          ExecuteMessage(toggleSessionTask, {
            isComplete: message.value,
            taskId: this.id,
            userId: message.user_id,
          }),
        );
        break;
      }
    }
  }
}

export class TaskContext extends ActorContext<TaskMessage> {
  public override actor_category: string = "task";
  constructor() {
    super();
  }

  protected override create_actor(id: string): Actor<TaskMessage> {
    return new TaskActor(id, this);
  }
}
