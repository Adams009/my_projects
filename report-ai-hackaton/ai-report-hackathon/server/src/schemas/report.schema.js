import { z } from "zod";

export const createReportSchema = z.object({
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
    "NEEDS_INFORMATION",
    "REASSIGNMENT_REQUESTED",
    "RESOLVED",
    "VERIFIED",
    "CLOSED",
  ]),
  notes: z.string().trim().max(2000).optional(),
});

export const assignReportSchema = z.object({
  teamId: z.string().trim().min(1).optional(),
});