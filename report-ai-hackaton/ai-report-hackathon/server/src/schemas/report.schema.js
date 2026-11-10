import { z } from "zod";

export const createReportSchema = z.object({
  organizationId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  title: z.string().trim().min(3).max(255).optional(),
  description: z.string().trim().min(10).max(5000),
  category: z.enum([
    "ROAD_INFRASTRUCTURE",
    "DRAINAGE_FLOODING",
    "WASTE_SANITATION",
    "WATER_PLUMBING",
    "ELECTRICAL_LIGHTING",
    "BUILDING_MAINTENANCE",
    "ICT_EQUIPMENT",
    "OTHER_FACILITY_ISSUE",
  ]),
  priority: z
    .enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"])
    .default("MEDIUM"),
});

export const updateReportStatusSchema = z.object({
  status: z.enum([
    "SUBMITTED",
    "UNDER_REVIEW",
    "ASSIGNED",
    "ACKNOWLEDGED",
    "IN_PROGRESS",
    "AWAITING_REVIEW",
    "NEEDS_INFORMATION",
    "REASSIGNMENT_REQUESTED",
    "RESOLVED",
    "VERIFIED",
    "CLOSED",
  ]),
  notes: z.string().trim().max(2000).optional(),
});

export const assignReportSchema = z.object({
  teamId: z.string().uuid(),
});

export const createTeamSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional(),
});

export const completeAssignmentSchema = z.object({
  completionNote: z.string().trim().min(10).max(3000),
});

export const reviewAssignmentSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  reviewNote: z.string().trim().max(3000).optional(),
});