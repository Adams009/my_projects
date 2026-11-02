import { Router } from "express";
import {
  createReport,
  listReports,
  getReportHistory,
  updateReportStatus,
  assignReport,
} from "../controllers/report.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";


const reportRouter = Router();

reportRouter.use(requireAuth); // Apply authentication middleware to all report routes

reportRouter.post("/", createReport);
reportRouter.get("/", listReports);
reportRouter.put("/:reportId/status", updateReportStatus);
reportRouter.get("/:reportId/history", getReportHistory);
reportRouter.post("/:reportId/assign", assignReport);

export default reportRouter;