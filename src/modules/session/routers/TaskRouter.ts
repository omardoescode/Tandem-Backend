import { protectedRoute } from "@/modules/auth/middleware";
import { Hono } from "hono";
import { TaskService } from "../services/TaskService";
import { ErrorResponse, SuccessResponse } from "@/utils/responses";
import { StatusCodes } from "http-status-codes";
import { describeRoute, validator, resolver } from "hono-openapi";
import z from "zod";

const taskRouter = new Hono();

// TODO: Add cursor-based pagination
// TODO: Fill in these schemas for docs generation
taskRouter.get(
  "",
  describeRoute({
    description: "Get user tasks",
    tags: ["Tasks"],
  }),
  protectedRoute,
  async (c) => {
    const { id: userId } = c.get("user");

    const tasks = await TaskService.getTasksData(userId);
    return c.json(SuccessResponse(tasks));
  },
);

taskRouter.put(
  "/:id/toggle",
  describeRoute({
    description: "Toggle a task completion status",
    tags: ["Tasks"],
  }),
  protectedRoute,
  validator("param", z.object({ id: z.string().nonempty() })),
  validator("json", z.object({ isComplete: z.boolean() })),
  async (c) => {
    // NOTE: Should we consider checking for the task id belonging to this user
    const { id: userId } = c.get("user");
    const { id: taskId } = c.req.valid("param");
    const { isComplete } = c.req.valid("json");

    const task = TaskService.toggleTask(userId, taskId, isComplete);
    if (!task) return c.json(ErrorResponse("not found"), StatusCodes.NOT_FOUND);

    return c.json(SuccessResponse());
  },
);

export default taskRouter;
