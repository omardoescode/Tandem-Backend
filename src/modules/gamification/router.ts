import { Hono } from "hono";
import { AchievementService } from "./services/AchievementService";
import { SuccessResponse } from "@/utils/responses";

const gamificationRouter = new Hono();

gamificationRouter.get("achievements", async (c) => {
  const r = await AchievementService.getAchievements();
  return c.json(SuccessResponse(r));
});

export default gamificationRouter;
