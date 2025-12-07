import { v7 } from "uuid";
import { Task } from "../entities/Task";
import { TaskRepository } from "../repositories/TaskRepository";

async function toggleTask(taskId: string, isComplete: boolean) {
  const task = await TaskRepository.getByTaskId(taskId);
  if (!task) return;
  task.toggleTask(isComplete);
  await TaskRepository.save();
}

async function createSessionTasks(
  sessionId: string,
  data: { title: string; userId: string }[],
): Promise<Task[]> {
  const tasks = data.map(
    (t) =>
      new Task({
        userId: t.userId,
        isComplete: false,
        taskId: v7(),
        title: t.title,
        sessionId,
      }),
  );

  await TaskRepository.save(...tasks);
  return tasks;
}

export const TaskService = { toggleTask, createSessionTasks };
