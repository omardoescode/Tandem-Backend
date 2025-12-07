import { Entity } from "@/utils/Entity";

export interface TaskData {
  taskId: string;
  title: string;
  isComplete: boolean;
  userId: string;
  sessionId: string;
}

export class Task extends Entity<TaskData> {
  public toggleTask(isComplete: boolean) {
    this.set("isComplete", isComplete);
  }
}
