import { protectedRoute } from "@/modules/auth/middleware";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { TaskIdParamSchema } from "../validation";
import { TaskService } from "../services/TaskService";
import { ErrorResponse, SuccessResponse } from "@/utils/responses";
import { StatusCodes } from "http-status-codes";

const taskRouter = new Hono();
taskRouter.put(
  "/task/:id/toggle",
  protectedRoute,
  zValidator("param", TaskIdParamSchema),
  async (c) => {
    // NOTE: Should we consider checking for the task id belonging to this user
    const { taskId } = c.req.valid("param");

    const task = TaskService.toggleTask(taskId);
    if (!task) return c.json(ErrorResponse("not found"), StatusCodes.NOT_FOUND);

    return c.json(SuccessResponse());
  },
);

export default taskRouter;
