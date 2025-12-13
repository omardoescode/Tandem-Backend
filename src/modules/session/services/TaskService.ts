import { v7 } from "uuid";
import { Task, type TaskData } from "../entities/Task";
import { TaskRepository } from "../repositories/TaskRepository";

async function toggleTask(
  userId: string,
  taskId: string,
  isComplete?: boolean,
): Promise<boolean> {
  const task = await TaskRepository.getByTaskId(taskId);
  if (!task || task.get("userId") !== userId) return false;

  const new_value =
    isComplete == undefined ? !task.get("isComplete") : isComplete;
  task.toggleTask(new_value);

  await TaskRepository.save(task);
  return true;
}

async function getTasksData(
  userId: string,
): Promise<Omit<TaskData, "userId">[]> {
  const res = await TaskRepository.getByUserId(userId);
  return res.map((x) => {
    const { userId, ...rest } = x.getCommittedState();
    return rest;
  });
}
async function createSessionTasks(
  sessionId: string,
  data: { title: string; userId: string }[],
): Promise<Task[]> {
  const tasks = data.map(
    (t) =>
      new Task(
        {
          userId: t.userId,
          isComplete: false,
          taskId: v7(),
          title: t.title,
          sessionId,
        },
        { initiallyDirty: true },
      ),
  );

  await TaskRepository.save(...tasks);
  return tasks;
}

export const TaskService = { toggleTask, createSessionTasks, getTasksData };
