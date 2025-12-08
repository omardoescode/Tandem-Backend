import { Hono } from "hono";
import { AchievementService } from "./services/AchievementService";
import { SuccessResponse } from "@/utils/responses";
import { protectedRoute } from "../auth/middleware";

const gamificationRouter = new Hono();

gamificationRouter.get("achievements", async (c) => {
  const r = await AchievementService.getAchievements();
  return c.json(SuccessResponse(r));
});

gamificationRouter.get("my_achievements", protectedRoute, async (c) => {
  const { id: userId } = c.get("user");
  const r = await AchievementService.getUserAhicevements(userId);

  return c.json(SuccessResponse(r));
});

export default gamificationRouter;
