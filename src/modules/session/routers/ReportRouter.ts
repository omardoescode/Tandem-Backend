import { protectedRoute } from "@/modules/auth/middleware";
import { Hono } from "hono";
import { SuccessResponse } from "@/utils/responses";
import { describeRoute } from "hono-openapi";
import { CheckinService } from "../services/CheckinService";

const reportRouter = new Hono();

// TODO: Consider adding cursor-based pagination support
reportRouter.get(
  "",
  describeRoute({
    description: "Get all reports of the user",
  }),
  protectedRoute,
  async (c) => {
    const { id } = c.get("user");
    const reports = await CheckinService.getRevieweeReportsData(id);
    return c.json(SuccessResponse(reports));
  },
);

export default reportRouter;
