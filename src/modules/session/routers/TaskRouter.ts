import { protectedRoute } from "@/modules/auth/middleware";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import {
  TaskCompletionStatusBodySchema,
  TaskIdParamSchema,
} from "../validation";
import { TaskService } from "../services/TaskService";
import { ErrorResponse, SuccessResponse } from "@/utils/responses";
import { StatusCodes } from "http-status-codes";
import { describeRoute } from "hono-openapi";

const taskRouter = new Hono();
taskRouter.put(
  "/task/:id/toggle",
  describeRoute({
    description: "Toggle a task completion status",
  }),
  protectedRoute,
  zValidator("param", TaskIdParamSchema),
  zValidator("json", TaskCompletionStatusBodySchema),
  async (c) => {
    // NOTE: Should we consider checking for the task id belonging to this user
    const { taskId } = c.req.valid("param");
    const { isComplete } = c.req.valid("json");

    const task = TaskService.toggleTask(taskId, isComplete);
    if (!task) return c.json(ErrorResponse("not found"), StatusCodes.NOT_FOUND);

    return c.json(SuccessResponse());
  },
);

export default taskRouter;
