import { Router } from "express";
import {
  createReport,
  listReports,
  getReportHistory,
  updateReportStatus,
  assignReport,
} from "../controllers/report.controller.js";

const reportRouter = Router();

reportRouter.post("/", createReport);
reportRouter.get("/", listReports);
reportRouter.put("/:reportId/status", updateReportStatus);
reportRouter.get("/:reportId/history", getReportHistory);
reportRouter.post("/:reportId/assign", assignReport);

export default reportRouter;