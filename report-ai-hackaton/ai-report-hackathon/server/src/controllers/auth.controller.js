import argon2 from "argon2";
import crypto from "node:crypto";
import { prisma } from "../lib/prisma.js";
import {
  acceptInvitationSchema,
  createInvitationSchema,
  forgotPasswordSchema,
  invitationDecisionSchema,
  loginSchema,
  logoutSchema,
  refreshTokenSchema,
  registerReporterSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from "../schemas/auth.schema.js";
import {
  getRefreshCookieOptions,
} from "../config/environment.js";
import {
  getClientUrl,
  sendEmail,
} from "../services/email.service.js";
import {
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL,
  createAccessToken,
  createRefreshToken,
  generateRandomToken,
  hashToken,
  verifyRefreshToken,
} from "../services/token.service.js";

function createSlug(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "organization";
}

async function createUniqueOrganizationSlug(transaction, organizationName) {
  const baseSlug = createSlug(organizationName);
  let slug = baseSlug;
  let suffix = 2;

  while (await transaction.organization.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

function toPublicUser(user, memberships = []) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    memberships,
  };
}

function hashInvitationToken(token) {
  return hashToken(token);
}

const dummyPasswordHashPromise = argon2.hash(crypto.randomBytes(32).toString("hex"));
const REFRESH_COOKIE_NAME = "civicfixRefreshToken";
const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

function setRefreshCookie(res, refreshToken) {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    ...getRefreshCookieOptions(),
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, getRefreshCookieOptions());
}

function parseTokenLifetimeInSeconds(tokenLifetime) {
  const tokenLifetimePattern = /^(\d+)([smhd])$/;
  const match = tokenLifetime.match(tokenLifetimePattern);

  if (!match) {
    throw new Error(`Unsupported token lifetime format: ${tokenLifetime}`);
  }

  const [, rawValue, unit] = match;
  const value = Number(rawValue);

  const unitMultipliers = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };

  return value * unitMultipliers[unit];
}

async function issueAuthSession(user, memberships, database = prisma) {
  const refreshTokenId = crypto.randomUUID();
  const refreshToken = createRefreshToken(user, refreshTokenId);
  const decodedRefreshToken = verifyRefreshToken(refreshToken);

  if (
    typeof decodedRefreshToken !== "object" ||
    decodedRefreshToken === null ||
    typeof decodedRefreshToken.exp !== "number"
  ) {
    throw new Error("Unable to decode refresh token expiration");
  }

  await database.refreshToken.create({
    data: {
      id: refreshTokenId,
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(decodedRefreshToken.exp * 1000),
    },
  });

  return {
    token: createAccessToken(user, refreshTokenId),
    refreshToken,
    accessTokenExpiresIn: parseTokenLifetimeInSeconds(ACCESS_TOKEN_TTL),
    refreshTokenExpiresIn: parseTokenLifetimeInSeconds(REFRESH_TOKEN_TTL),
    user: toPublicUser(user, memberships),
  };
}

export async function register(req, res) {
  const validationResult = registerSchema.safeParse(req.body);

  if (!validationResult.success) {
    return res.status(400).json({
      status: "error",
      message: "Invalid registration data",
      errors: validationResult.error.flatten(),
    });
  }

  const {
    organizationName,
    organizationType,
    firstName,
    lastName,
    email,
    password,
  } = validationResult.data;

  try {

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({
        status: "error",
        message: "An account with this email already exists",
      });
    }

    const passwordHash = await argon2.hash(password);

    const user = await prisma.$transaction(async (transaction) => {
      const organizationSlug = await createUniqueOrganizationSlug(
        transaction,
        organizationName,
      );

      const organization = await transaction.organization.create({
        data: {
          name: organizationName,
          slug: organizationSlug,
          type: organizationType,
        },
      });

      const createdUser = await transaction.user.create({
        data: {
          organizationId: organization.id,
          firstName,
          lastName,
          email,
          passwordHash,
          role: "ORGANIZATION_ADMIN",
        },
      });

      await transaction.organizationMembership.create({
        data: {
          userId: createdUser.id,
          organizationId: organization.id,
          role: "ORGANIZATION_ADMIN",
        },
      });

      return createdUser;
    });

    return res.status(201).json({
      status: "success",
      message: "Organization created successfully"
    });
  } catch (error) {
    console.error("Registration error:", error);

    return res.status(500).json({
      status: "error",
      message: "Unable to create account",
    });
  }
}

export async function registerReporter(req, res) {
  const validationResult = registerReporterSchema.safeParse(req.body);

  if (!validationResult.success) {
    return res.status(400).json({
      status: "error",
      message: "Invalid reporter registration data",
      errors: validationResult.error.flatten(),
    });
  }

  const { firstName, lastName, email, password } = validationResult.data;

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      return res.status(409).json({
        status: "error",
        message: "An account with this email already exists",
      });
    }

    const passwordHash = await argon2.hash(password);
    await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        passwordHash,
        role: "REPORTER",
      },
    });

    return res.status(201).json({
      status: "success",
      message: "Reporter account created successfully",
    });
  } catch (error) {
    console.error("Reporter registration error:", error);

    return res.status(500).json({
      status: "error",
      message: "Unable to create reporter account",
    });
  }
}

export async function login(req, res) {
  const validationResult = loginSchema.safeParse(req.body);

  if (!validationResult.success) {
    return res.status(400).json({
      status: "error",
      message: "Invalid login data",
      errors: validationResult.error.flatten(),
    });
  }

  const { email, password } = validationResult.data;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: {
            organization: {
              isActive: true,
            },
          },
          select: {
            organizationId: true,
            role: true,
            teamId: true,
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    const passwordHash = user?.passwordHash || await dummyPasswordHashPromise;
    const passwordMatches = await argon2.verify(passwordHash, password);

    if (!user || !user.passwordHash || !passwordMatches) {
      return res.status(401).json({
        status: "error",
        message: "Invalid email or password",
      });
    }

    await prisma.refreshToken.deleteMany({
      where: {
        userId: user.id,
        OR: [
          { revokedAt: { not: null } },
          { expiresAt: { lte: new Date() } },
        ],
      },
    });

    const session = await issueAuthSession(user, user.memberships);
    setRefreshCookie(res, session.refreshToken);

    return res.json({
      status: "success",
      message: "Login successful",
      token: session.token,
      accessToken: session.token,
      accessTokenExpiresIn: session.accessTokenExpiresIn,
      refreshTokenExpiresIn: session.refreshTokenExpiresIn,
      user: session.user,
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      status: "error",
      message: "Unable to log in",
    });
  }
}

export async function refreshToken(req, res) {
  const rawToken =
    req.cookies?.[REFRESH_COOKIE_NAME] ||
    (process.env.NODE_ENV === "production"
      ? undefined
      : req.body?.refreshToken);
  const validationResult = refreshTokenSchema.safeParse({
    refreshToken: rawToken,
  });

  if (!validationResult.success) {
    clearRefreshCookie(res);
    return res.status(400).json({
      status: "error",
      message: "Invalid refresh token data",
      errors: validationResult.error.flatten(),
    });
  }

  const { refreshToken } = validationResult.data;
  if (!refreshToken) {
    clearRefreshCookie(res);
    return res.status(401).json({
      status: "error",
      message: "Refresh session is unavailable",
    });
  }

  try {
    const payload = verifyRefreshToken(refreshToken);

    if (
      typeof payload !== "object" ||
      payload === null ||
      payload.tokenType !== "refresh" ||
      typeof payload.sub !== "string" ||
      typeof payload.tokenId !== "string"
    ) {
      clearRefreshCookie(res);
      return res.status(401).json({
        status: "error",
        message: "Invalid refresh token",
      });
    }

    const session = await prisma.$transaction(
      async (transaction) => {
        const storedToken = await transaction.refreshToken.findUnique({
          where: { id: payload.tokenId },
          include: {
            user: {
              include: {
                memberships: {
                  where: { organization: { isActive: true } },
                  select: {
                    organizationId: true,
                    role: true,
                    teamId: true,
                    organization: {
                      select: { id: true, name: true, slug: true },
                    },
                  },
                },
              },
            },
          },
        });

        if (
          !storedToken ||
          storedToken.userId !== payload.sub ||
          storedToken.revokedAt ||
          storedToken.expiresAt <= new Date() ||
          storedToken.tokenHash !== hashToken(refreshToken)
        ) {
          return null;
        }

        const revoked = await transaction.refreshToken.updateMany({
          where: {
            id: storedToken.id,
            userId: storedToken.userId,
            tokenHash: hashToken(refreshToken),
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: { revokedAt: new Date() },
        });

        if (revoked.count !== 1) {
          return null;
        }

        const nextSession = await issueAuthSession(
          storedToken.user,
          storedToken.user.memberships,
          transaction,
        );

        await transaction.refreshToken.deleteMany({
          where: {
            userId: storedToken.userId,
            expiresAt: { lte: new Date() },
          },
        });

        return nextSession;
      },
      { isolationLevel: "Serializable" },
    );

    if (!session) {
      clearRefreshCookie(res);
      return res.status(401).json({
        status: "error",
        message: "Invalid or expired refresh token",
      });
    }

    setRefreshCookie(res, session.refreshToken);

    return res.json({
      status: "success",
      message: "Token refreshed",
      token: session.token,
      accessToken: session.token,
      accessTokenExpiresIn: session.accessTokenExpiresIn,
      refreshTokenExpiresIn: session.refreshTokenExpiresIn,
      user: session.user,
    });
  } catch (error) {
    if (
      error?.name === "JsonWebTokenError" ||
      error?.name === "TokenExpiredError" ||
      error?.code === "P2034"
    ) {
      clearRefreshCookie(res);
      return res.status(401).json({
        status: "error",
        message: "Invalid or expired refresh token",
      });
    }

    console.error("Refresh token error:", error);
    return res.status(500).json({
      status: "error",
      message: "Unable to refresh session",
    });
  }
}

export async function logout(req, res) {
  const validationResult = logoutSchema.safeParse(req.body || {});

  if (!validationResult.success) {
    return res.status(400).json({
      status: "error",
      message: "Invalid logout request",
      errors: validationResult.error.flatten(),
    });
  }

  const { logoutAll } = validationResult.data;

  try {
    if (logoutAll) {
      await prisma.refreshToken.updateMany({
        where: {
          userId: req.user.id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    } else {
      await prisma.refreshToken.updateMany({
        where: {
          id: req.user.sessionId,
          userId: req.user.id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    }

    clearRefreshCookie(res);
    return res.json({
      status: "success",
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({
      status: "error",
      message: "Unable to process logout request",
    });
  }
}

export async function forgotPassword(req, res) {
  const validationResult = forgotPasswordSchema.safeParse(req.body);

  if (!validationResult.success) {
    return res.status(400).json({
      status: "error",
      message: "Invalid forgot password data",
      errors: validationResult.error.flatten(),
    });
  }

  const { email } = validationResult.data;

  try {
    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (user?.passwordHash) {
      const rawToken = generateRandomToken(32);

      await prisma.$transaction(async (transaction) => {
        await transaction.passwordResetToken.deleteMany({
          where: { userId: user.id },
        });
        await transaction.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash: hashToken(rawToken),
            expiresAt: new Date(Date.now() + 1000 * 60 * 30),
          },
        });
      });

      try {
        await sendEmail({
          to: user.email,
          subject: "Reset your CivicFix password",
          text: [
            "A password reset was requested for your CivicFix account.",
            "",
            `Use this one-time link within 30 minutes: ${getClientUrl("/reset-password", rawToken)}`,
            "",
            "If you did not request this change, you can ignore this email.",
          ].join("\n"),
        });
      } catch (emailError) {
        console.error("Password reset email delivery failed.", {
          code: emailError?.code,
          command: emailError?.command,
          responseCode: emailError?.responseCode,
        });

        try {
          await prisma.passwordResetToken.deleteMany({
            where: { tokenHash: hashToken(rawToken) },
          });
        } catch (cleanupError) {
          console.error("Unable to invalidate undelivered reset token:", cleanupError);
        }
      }
    }

    return res.json({
      status: "success",
      message: "a password reset link has been sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({
      status: "error",
      message: "Unable to process forgot password request",
    });
  }
}

export async function updateProfile(req, res) {
  const validationResult = updateProfileSchema.safeParse(req.body);

  if (!validationResult.success) {
    return res.status(400).json({
      status: "error",
      message: "Invalid profile data",
      errors: validationResult.error.flatten(),
    });
  }

  const { firstName, lastName, currentPassword, newPassword } =
    validationResult.data;

  try {
    const existingUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        passwordHash: true,
      },
    });

    if (!existingUser) {
      return res.status(404).json({
        status: "error",
        message: "User account not found",
      });
    }

    let passwordHash;
    if (newPassword) {
      if (
        !existingUser.passwordHash ||
        !currentPassword ||
        !(await argon2.verify(existingUser.passwordHash, currentPassword))
      ) {
        return res.status(400).json({
          status: "error",
          message: "Current password is incorrect",
        });
      }

      passwordHash = await argon2.hash(newPassword);
    }

    const updatedUser = await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.update({
        where: { id: req.user.id },
        data: {
          firstName,
          lastName,
          ...(passwordHash ? { passwordHash } : {}),
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      });

      if (passwordHash) {
        await transaction.refreshToken.updateMany({
          where: {
            userId: req.user.id,
            id: { not: req.user.sessionId },
            revokedAt: null,
          },
          data: { revokedAt: new Date() },
        });
      }

      return user;
    });

    return res.json({
      status: "success",
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return res.status(500).json({
      status: "error",
      message: "Unable to update profile",
    });
  }
}

export async function resetPassword(req, res) {
  const validationResult = resetPasswordSchema.safeParse(req.body);

  if (!validationResult.success) {
    return res.status(400).json({
      status: "error",
      message: "Invalid reset password data",
      errors: validationResult.error.flatten(),
    });
  }

  const { token, password } = validationResult.data;
  const tokenHash = hashToken(token);

  try {
    const passwordHash = await argon2.hash(password);

    const resetCompleted = await prisma.$transaction(
      async (transaction) => {
        const passwordResetToken =
          await transaction.passwordResetToken.findUnique({
            where: { tokenHash },
            select: { id: true, userId: true },
          });

        if (!passwordResetToken) {
          return false;
        }

        const consumed = await transaction.passwordResetToken.updateMany({
          where: {
            id: passwordResetToken.id,
            usedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: { usedAt: new Date() },
        });

        if (consumed.count !== 1) {
          return false;
        }

        await transaction.user.update({
          where: { id: passwordResetToken.userId },
          data: { passwordHash },
        });
        await transaction.refreshToken.updateMany({
          where: {
            userId: passwordResetToken.userId,
            revokedAt: null,
          },
          data: { revokedAt: new Date() },
        });
        await transaction.passwordResetToken.updateMany({
          where: {
            userId: passwordResetToken.userId,
            usedAt: null,
          },
          data: { usedAt: new Date() },
        });

        return true;
      },
      { isolationLevel: "Serializable" },
    );

    if (!resetCompleted) {
      return res.status(400).json({
        status: "error",
        message: "Invalid or expired reset token",
      });
    }

    clearRefreshCookie(res);

    return res.json({
      status: "success",
      message: "Password reset successful",
    });
  } catch (error) {
    if (error?.code === "P2034") {
      return res.status(400).json({
        status: "error",
        message: "Invalid or expired reset token",
      });
    }

    console.error("Reset password error:", error);
    return res.status(500).json({
      status: "error",
      message: "Unable to reset password",
    });
  }
}

export async function createInvitation(req, res) {
    const validationResult = createInvitationSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        status: "error",
        message: "Invalid invitation data",
        errors: validationResult.error.flatten(),
      });
    }

    const { email, role, teamId, expiresInDays } = validationResult.data;
    const organizationId = req.user.organizationId;

    if (
      !organizationId ||
      !["ORGANIZATION_ADMIN", "SUPERVISOR"].includes(req.user.role)
    ) {
      return res.status(403).json({
        status: "error",
        message: "Only organization administrators can invite members",
      });
    }

    if (
      role === "ORGANIZATION_ADMIN" &&
      req.user.role !== "ORGANIZATION_ADMIN"
    ) {
      return res.status(403).json({
        status: "error",
        message: "Only an organization administrator can invite another administrator",
      });
    }

    try {
      if (teamId) {
        const team = await prisma.team.findFirst({
          where: { id: teamId, organizationId, isActive: true },
        });

        if (!team) {
          return res.status(404).json({
            status: "error",
            message: "Team not found in this organization",
          });
        }
      }

      const existingPendingInvitation =
        await prisma.organizationInvitation.findFirst({
          where: {
            organizationId,
            email,
            status: "PENDING",
            expiresAt: { gt: new Date() },
          },
        });

      if (existingPendingInvitation) {
        return res.status(409).json({
          status: "error",
          message: "A pending invitation already exists for this email",
        });
      }

      const rawToken = crypto.randomBytes(32).toString("hex");
      const invitation = await prisma.organizationInvitation.create({
        data: {
          organizationId,
          invitedById: req.user.id,
          email,
          tokenHash: hashInvitationToken(rawToken),
          role,
          teamId,
          expiresAt: new Date(Date.now() + expiresInDays * 86400000),
        },
        include: {
          organization: { select: { name: true } },
        },
      });

      let emailSent = false;
      try {
        emailSent = await sendEmail({
          to: invitation.email,
          subject: "You have a CivicFix organization invitation",
          text: [
            `You have been invited to join ${invitation.organization.name} on CivicFix.`,
            "",
            `Accept the invitation within ${expiresInDays} days: ${getClientUrl("/accept-invitation", rawToken)}`,
          ].join("\n"),
        });
      } catch (emailError) {
        console.error("Invitation email delivery failed.", {
          code: emailError?.code,
          command: emailError?.command,
          responseCode: emailError?.responseCode,
        });

        if (process.env.NODE_ENV === "production") {
          await prisma.organizationInvitation.update({
            where: { id: invitation.id },
            data: { status: "REVOKED" },
          });
          return res.status(503).json({
            status: "error",
            message: "Unable to deliver the invitation email",
          });
        }
      }

      const invitationResponse = {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        teamId: invitation.teamId,
        organizationName: invitation.organization.name,
        expiresAt: invitation.expiresAt,
        emailSent,
      };

      return res.status(201).json({
        status: "success",
        message: "Invitation created successfully",
        invitation:
          process.env.NODE_ENV === "production"
            ? invitationResponse
            : { ...invitationResponse, token: rawToken },
      });
    } catch (error) {
      console.error("Create invitation error:", error);
      return res.status(500).json({
        status: "error",
        message: "Unable to create invitation",
      });
    }
  }

  export async function acceptInvitation(req, res) {
    const validationResult = acceptInvitationSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        status: "error",
        message: "Invalid invitation acceptance data",
        errors: validationResult.error.flatten(),
      });
    }

    const { token, firstName, lastName, password } = validationResult.data;
    const tokenHash = hashInvitationToken(token);

    try {
      const newPasswordHash = password ? await argon2.hash(password) : null;
      const result = await prisma.$transaction(
        async (transaction) => {
          const invitation =
            await transaction.organizationInvitation.findUnique({
              where: { tokenHash },
            });

          if (
            !invitation ||
            invitation.status !== "PENDING" ||
            invitation.expiresAt <= new Date()
          ) {
            return { error: "INVALID" };
          }

          let user = req.user
            ? await transaction.user.findUnique({
                where: { id: req.user.id },
              })
            : await transaction.user.findUnique({
                where: { email: invitation.email },
              });

          if (user && !req.user) {
            return { error: "EXISTING_ACCOUNT" };
          }

          if (user && user.email !== invitation.email) {
            return { error: "EMAIL_MISMATCH" };
          }

          if (!user && (!firstName || !lastName || !newPasswordHash)) {
            return { error: "ACCOUNT_DETAILS_REQUIRED" };
          }

          if (!user) {
            user = await transaction.user.create({
              data: {
                email: invitation.email,
                firstName,
                lastName,
                passwordHash: newPasswordHash,
                role: invitation.role,
              },
            });
          }

          const claimed = await transaction.organizationInvitation.updateMany({
            where: {
              id: invitation.id,
              status: "PENDING",
              expiresAt: { gt: new Date() },
            },
            data: {
              acceptedAt: new Date(),
              status: "ACCEPTED",
            },
          });

          if (claimed.count !== 1) {
            throw new Error("INVITATION_ALREADY_USED");
          }

          const membership = await transaction.organizationMembership.upsert({
            where: {
              userId_organizationId: {
                userId: user.id,
                organizationId: invitation.organizationId,
              },
            },
            update: {
              role: invitation.role,
              teamId: invitation.teamId,
            },
            create: {
              userId: user.id,
              organizationId: invitation.organizationId,
              role: invitation.role,
              teamId: invitation.teamId,
            },
          });

          return { membership };
        },
        { isolationLevel: "Serializable" },
      );

      if (result.error === "INVALID") {
        return res.status(400).json({
          status: "error",
          message: "This invitation is invalid or expired",
        });
      }

      if (result.error === "EXISTING_ACCOUNT") {
        return res.status(409).json({
          status: "error",
          message: "Sign in with the invited email address to accept this invitation",
        });
      }

      if (result.error === "EMAIL_MISMATCH") {
        return res.status(403).json({
          status: "error",
          message: "Sign in with the invited email address",
        });
      }

      if (result.error === "ACCOUNT_DETAILS_REQUIRED") {
        return res.status(400).json({
          status: "error",
          message: "Name and password are required for a new invited account",
        });
      }

      return res.json({
        status: "success",
        message: "Invitation accepted successfully",
        membership: result.membership,
      });
    } catch (error) {
      if (
        error?.message === "INVITATION_ALREADY_USED" ||
        error?.code === "P2034" ||
        error?.code === "P2002"
      ) {
        return res.status(409).json({
          status: "error",
          message: "This invitation has already been used",
        });
      }

      console.error("Accept invitation error:", error);
      return res.status(500).json({
        status: "error",
        message: "Unable to accept invitation",
      });
    }
  }

export async function listMyInvitations(req, res) {
    try {
      const invitations = await prisma.organizationInvitation.findMany({
        where: {
          email: req.user.email,
          status: "PENDING",
          expiresAt: { gt: new Date() },
        },
        select: {
          id: true,
          role: true,
          teamId: true,
          expiresAt: true,
          organization: { select: { id: true, name: true, slug: true } },
          team: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return res.json({ status: "success", invitations });
    } catch (error) {
      console.error("List invitations error:", error);
      return res.status(500).json({
        status: "error",
        message: "Unable to load invitations",
      });
    }
}

export async function decideInvitation(req, res) {
    const validationResult = invitationDecisionSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        status: "error",
        message: "Choose whether to accept or decline the invitation",
        errors: validationResult.error.flatten(),
      });
    }

    const { invitationId } = req.params;
    const { decision } = validationResult.data;

    try {
      const invitation = await prisma.organizationInvitation.findFirst({
        where: {
          id: invitationId,
          email: req.user.email,
          status: "PENDING",
        },
      });

      if (!invitation || invitation.expiresAt <= new Date()) {
        return res.status(404).json({
          status: "error",
          message: "Invitation not found or expired",
        });
      }

      if (decision === "decline") {
        const declined = await prisma.organizationInvitation.updateMany({
          where: {
            id: invitation.id,
            email: req.user.email,
            status: "PENDING",
            expiresAt: { gt: new Date() },
          },
          data: {
            status: "DECLINED",
            declinedAt: new Date(),
          },
        });

        if (declined.count !== 1) {
          return res.status(409).json({
            status: "error",
            message: "This invitation is no longer available",
          });
        }

        return res.json({
          status: "success",
          message: "Invitation declined",
        });
      }

      const membership = await prisma.$transaction(async (transaction) => {
        const accepted = await transaction.organizationInvitation.updateMany({
          where: {
            id: invitation.id,
            email: req.user.email,
            status: "PENDING",
            expiresAt: { gt: new Date() },
          },
          data: {
            status: "ACCEPTED",
            acceptedAt: new Date(),
          },
        });

        if (accepted.count !== 1) {
          return null;
        }

        const createdMembership =
          await transaction.organizationMembership.upsert({
            where: {
              userId_organizationId: {
                userId: req.user.id,
                organizationId: invitation.organizationId,
              },
            },
            update: {
              role: invitation.role,
              teamId: invitation.teamId,
            },
            create: {
              userId: req.user.id,
              organizationId: invitation.organizationId,
              role: invitation.role,
              teamId: invitation.teamId,
            },
          });

        return createdMembership;
      });

      if (!membership) {
        return res.status(409).json({
          status: "error",
          message: "This invitation is no longer available",
        });
      }

      return res.json({
        status: "success",
        message: "Invitation accepted",
        membership,
      });
    } catch (error) {
      console.error("Decide invitation error:", error);
      return res.status(500).json({
        status: "error",
        message: "Unable to update invitation",
      });
    }
  }
