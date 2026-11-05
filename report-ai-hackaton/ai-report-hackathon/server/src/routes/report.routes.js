import { Router } from "express";
import {
  createReport,
  listReports,
  getReportHistory,
  updateReportStatus,
  assignReport,
  listReportOrganizations,
  listReportLocations,
} from "../controllers/report.controller.js";
import { requireRoles } from "../middleware/authorization.middleware.js";
import { requireAuth } from "../middleware/auth.middleware.js";


const reportRouter = Router();

reportRouter.use(requireAuth); // Apply authentication middleware to all report routes

reportRouter.get("/organizations", listReportOrganizations);
reportRouter.get("/organizations/:organizationId/locations", listReportLocations);
reportRouter.post("/", createReport);
reportRouter.get("/", listReports);
reportRouter.put(
  "/:reportId/status",
  requireRoles(
    "TRIAGE_OFFICER",
    "TEAM_MEMBER",
    "SUPERVISOR",
    "ORGANIZATION_ADMIN",
  ),
  updateReportStatus,
);
reportRouter.get("/:reportId/history", getReportHistory);
reportRouter.post(
  "/:reportId/assign",
  requireRoles("TRIAGE_OFFICER", "SUPERVISOR", "ORGANIZATION_ADMIN"),
  assignReport,
);

export default reportRouter;