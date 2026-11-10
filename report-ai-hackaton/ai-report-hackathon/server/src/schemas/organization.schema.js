import { z } from "zod";

export const updateOrganizationMemberSchema = z
  .object({
    role: z.enum([
      "REPORTER",
      "TRIAGE_OFFICER",
      "TEAM_MEMBER",
      "SUPERVISOR",
      "ORGANIZATION_ADMIN",
    ]),
    teamId: z.string().trim().min(1).nullable().default(null),
  })
  .superRefine((member, context) => {
    if (member.role === "TEAM_MEMBER" && !member.teamId) {
      context.addIssue({
        code: "custom",
        path: ["teamId"],
        message: "Choose a team for a team member",
      });
    }

    if (member.role !== "TEAM_MEMBER" && member.teamId) {
      context.addIssue({
        code: "custom",
        path: ["teamId"],
        message: "Only team members can be assigned to a team",
      });
    }
  });

export const createOrganizationLocationSchema = z.object({
  name: z.string().trim().min(2).max(150),
  description: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((description) => description || null),
});

export const updateOrganizationLocationSchema = z.object({
  name: z.string().trim().min(2).max(150),
  description: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((description) => description || null),
  isActive: z.boolean().optional(),
});
