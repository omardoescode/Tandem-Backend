import { db } from "@/db";
import { Task } from "../entities/Task";
import { SessionTaskTable } from "@/db/schemas/session";
import { and, eq } from "drizzle-orm";

export interface ITaskRepository {
  getByTaskId(taskId: string): Promise<Task | null>;
  getBySessionIdAndUserId(sessionId: string, userId: string): Promise<Task[]>;
  save(...tasks: Task[]): Promise<void>;
}

export const TaskRepository: ITaskRepository = {
  getByTaskId: async (taskId: string) => {
    const result = await db
      .select()
      .from(SessionTaskTable)
      .where(eq(SessionTaskTable.taskId, taskId));

    if (result.length === 0) return null;
    return new Task(result[0]!);
  },

  getBySessionIdAndUserId: async (
    sessionId: string,
    userId: string,
  ): Promise<Task[]> => {
    const result = await db
      .select()
      .from(SessionTaskTable)
      .where(
        and(
          eq(SessionTaskTable.sessionId, sessionId),
          eq(SessionTaskTable.userId, userId),
        ),
      );

    return result.map((r) => new Task(r));
  },

  save: async (...tasks: Task[]): Promise<void> => {
    await Promise.all(
      tasks.map(async (task) => {
        if (!task.isDirty()) return;
        const changes = task.getChanges();
        await db
          .insert(SessionTaskTable)
          .values({
            ...task.getCommittedState(),
            ...task.getChanges(),
          })
          .onConflictDoUpdate({
            target: SessionTaskTable.taskId,
            set: changes,
          });
        task.commit();
      }),
    );
  },
};
