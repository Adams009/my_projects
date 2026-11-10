import { z } from "zod";

const emailSchema = z.string().trim().email().transform((email) => email.toLowerCase());

const organizationTypeSchema = z.enum([
  "GOVERNMENT",
  "COMPANY",
  "SCHOOL",
  "HOSPITAL",
  "NGO",
  "COMMUNITY",
  "OTHER",
]);

export const registerSchema = z.object({
  organizationName: z.string().trim().min(2).max(150),
  organizationType: organizationTypeSchema.optional(),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: emailSchema,
  password: z.string().min(8).max(128),
});

export const registerReporterSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: emailSchema,
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().trim().min(20).optional(),
});

export const logoutSchema = z.object({
  logoutAll: z.boolean().optional().default(false),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(20),
  password: z.string().min(8).max(128),
});

export const updateProfileSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    currentPassword: z.string().max(128).optional(),
    newPassword: z.string().min(8).max(128).optional(),
  })
  .superRefine((profile, context) => {
    if (profile.newPassword && !profile.currentPassword) {
      context.addIssue({
        code: "custom",
        path: ["currentPassword"],
        message: "Current password is required to set a new password",
      });
    }
  });

export const createInvitationSchema = z
  .object({
    email: emailSchema,
    role: z.enum([
      "REPORTER",
      "TRIAGE_OFFICER",
      "TEAM_MEMBER",
      "SUPERVISOR",
      "ORGANIZATION_ADMIN",
    ]),
    teamId: z.string().trim().min(1).optional(),
    expiresInDays: z.number().int().min(1).max(30).default(7),
  })
  .superRefine((invitation, context) => {
    if (invitation.role === "TEAM_MEMBER" && !invitation.teamId) {
      context.addIssue({
        code: "custom",
        path: ["teamId"],
        message: "Choose a team for a team member invitation",
      });
    }

    if (invitation.role !== "TEAM_MEMBER" && invitation.teamId) {
      context.addIssue({
        code: "custom",
        path: ["teamId"],
        message: "Only team member invitations can include a team",
      });
    }
  });

export const acceptInvitationSchema = z.object({
  token: z.string().trim().min(20),
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  password: z.string().min(8).max(128).optional(),
});

export const invitationDecisionSchema = z.object({
  decision: z.enum(["accept", "decline"]),
});
