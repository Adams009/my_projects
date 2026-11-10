import { Router } from "express";
import {
  createOrganizationLocation,
  deactivateOrganizationLocation,
  listOrganizationLocations,
  listOrganizationMembers,
  removeOrganizationMember,
  updateOrganizationLocation,
  updateOrganizationMember,
} from "../controllers/organization.controller.js";
import { requireRoles } from "../middleware/authorization.middleware.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const organizationRouter = Router();

organizationRouter.use(requireAuth, requireRoles("ORGANIZATION_ADMIN"));
organizationRouter.get("/locations", listOrganizationLocations);
organizationRouter.post("/locations", createOrganizationLocation);
organizationRouter.put("/locations/:locationId", updateOrganizationLocation);
organizationRouter.delete(
  "/locations/:locationId",
  deactivateOrganizationLocation,
);
organizationRouter.get("/members", listOrganizationMembers);
organizationRouter.put("/members/:membershipId", updateOrganizationMember);
organizationRouter.delete("/members/:membershipId", removeOrganizationMember);

export default organizationRouter;
