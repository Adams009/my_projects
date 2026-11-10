import { Router } from "express";
import {
  createReport,
  listReports,
  listReportAssignments,
  listTeamAssignments,
  getReportHistory,
  updateReportStatus,
  assignReport,
  acknowledgeAssignment,
  startAssignment,
  completeAssignment,
  reviewAssignment,
  listReportOrganizations,
  listReportTeams,
  createReportTeam,
  listReportLocations,
} from "../controllers/report.controller.js";
import { requireRoles } from "../middleware/authorization.middleware.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { uploadReportImages } from "../middleware/report-image.middleware.js";
import { rateLimit } from "express-rate-limit";
import { createRateLimitStore } from "../lib/rate-limit-store.js";


const reportRouter = Router();
const reportCreationLimiter = rateLimit({
  store: createRateLimitStore("report-creation"),
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler(req, res) {
    return res.status(429).json({
      status: "error",
      message: "Too many reports submitted. Please try again later.",
    });
  },
});

reportRouter.use(requireAuth); // Apply authentication middleware to all report routes

reportRouter.get("/organizations", listReportOrganizations);
reportRouter.get("/teams", listReportTeams);
reportRouter.post(
  "/teams",
  requireRoles("SUPERVISOR", "ORGANIZATION_ADMIN"),
  createReportTeam,
);

reportRouter.get("/organizations/:organizationId/locations", listReportLocations);

reportRouter.post(
  "/",
  reportCreationLimiter,
  uploadReportImages,
  createReport,
);
reportRouter.get("/", listReports);
reportRouter.get(
  "/assignments/my-team",
  requireRoles("TEAM_MEMBER", "SUPERVISOR", "ORGANIZATION_ADMIN"),
  listTeamAssignments,
);
reportRouter.get("/:reportId/assignments", listReportAssignments);
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

reportRouter.post(
  "/assignments/:assignmentId/acknowledge",
  requireRoles("TEAM_MEMBER", "SUPERVISOR", "ORGANIZATION_ADMIN"),
  acknowledgeAssignment,
);

reportRouter.post(
  "/assignments/:assignmentId/start",
  requireRoles("TEAM_MEMBER", "SUPERVISOR", "ORGANIZATION_ADMIN"),
  startAssignment,
);

reportRouter.post(
  "/assignments/:assignmentId/complete",
  requireRoles("TEAM_MEMBER", "SUPERVISOR", "ORGANIZATION_ADMIN"),
  completeAssignment,
);

reportRouter.post(
  "/assignments/:assignmentId/review",
  requireRoles("SUPERVISOR", "ORGANIZATION_ADMIN"),
  reviewAssignment,
);
export default reportRouter;