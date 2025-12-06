import type { Actor } from "@/framework/Actor";
import {
  PersistantActor,
  PersistentContext,
  type BaseState,
  type PersistenceMessage,
} from "@/framework/PersistentActor";
import { getSessionTask, persistSessionTask } from "db/tandem_sessions_sql";

interface TaskState extends BaseState {
  sessionId: string;
  userId: string;
  title: string;
  isComplete: boolean;
  createdAt: Date;
}

type TaskMessage = {
  type: "toggle";
  args: Partial<Omit<TaskState, "createdAt">>;
};

export class TaskActor extends PersistantActor<TaskMessage, TaskState> {
  protected override async handleMessage(message: TaskMessage): Promise<void> {
    switch (message.type) {
      case "toggle":
        this.to_update = message.args;
        break;
      default:
        super.handleMessage(message);
    }
  }
}

export class TaskContext extends PersistentContext<TaskMessage, TaskState> {
  public override actor_category: string = "task";
  constructor() {
    super({
      persist: persistSessionTask,
      get: getSessionTask,
    });
  }

  protected override create_actor(
    id: string,
  ): Actor<TaskMessage | PersistenceMessage> {
    return new TaskActor(id, this);
  }
}
