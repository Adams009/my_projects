import { z } from "zod";

export const aiReportAnalysisSchema = z.object({
  summary: z.string().trim().min(1).max(500),
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
  confidence: z.number().min(0).max(1),
  rationale: z.string().trim().min(1).max(500),
});