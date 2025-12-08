import { Hono } from "hono";
import { AchievementService } from "./services/AchievementService";
import { ErrorResponse, SuccessResponse } from "@/utils/responses";
import { protectedRoute } from "../auth/middleware";
import { UserStatService } from "./services/UserStatService";
import { StatusCodes } from "http-status-codes";
import { describeRoute } from "hono-openapi";

const gamificationRouter = new Hono();

gamificationRouter.get(
  "achievements",
  describeRoute({
    description: "Get all available achievements data",
  }),
  async (c) => {
    const r = await AchievementService.getAchievementsData();
    return c.json(SuccessResponse(r));
  },
);

gamificationRouter.get(
  "my_achievements",

  describeRoute({
    description: "Get all user achievements",
  }),
  protectedRoute,
  async (c) => {
    const { id: userId } = c.get("user");
    const r = await AchievementService.getUserAhicevementsData(userId);

    return c.json(SuccessResponse(r));
  },
);

gamificationRouter.get(
  "my_stats",
  describeRoute({
    description: "Get User Stats",
  }),
  protectedRoute,
  async (c) => {
    const { id: userId } = c.get("user");
    const r = await UserStatService.getStatData(userId);

    if (!r) return c.json(ErrorResponse("not found"), StatusCodes.NOT_FOUND);
    return c.json(SuccessResponse(r));
  },
);

export default gamificationRouter;
