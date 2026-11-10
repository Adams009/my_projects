import { prisma } from "../lib/prisma.js";
import { verifyAccessToken } from "../services/token.service.js";

export async function requireAuth(req, res, next) {
  const authorizationHeader = req.headers.authorization;

  if (!authorizationHeader?.startsWith("Bearer ")) {
    return res.status(401).json({
      status: "error",
      message: "Authentication required",
    });
  }

  const token = authorizationHeader.slice(7); // Remove "Bearer " prefix
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    console.error("JWT_SECRET is not configured");

    return res.status(500).json({
      status: "error",
      message: "Authentication is not configured",
    });
  }

  let payload;

  try {
    payload = verifyAccessToken(token);
  } catch {
    return res.status(401).json({
      status: "error",
      message: "Invalid or expired token",
    });
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    typeof payload.sub !== "string" ||
    payload.tokenType !== "access" ||
    typeof payload.sessionId !== "string"
  ) {
    return res.status(401).json({
      status: "error",
      message: "Invalid authentication token",
    });
  }

  try {
    const [user, session] = await Promise.all([
      prisma.user.findUnique({
        where: {
          id: payload.sub,
        },
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
      }),
      prisma.refreshToken.findFirst({
        where: {
          id: payload.sessionId,
          userId: payload.sub,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: { id: true },
      }),
    ]);

    if (!user || !session) {
      return res.status(401).json({
        status: "error",
        message: "User account or session is unavailable",
      });
    }

    const requestedOrganizationId =
      req.headers["x-organization-id"] || payload.organizationId;
    let activeMembership = null;

    if (requestedOrganizationId) {
      activeMembership = user.memberships.find(
        (membership) => membership.organizationId === requestedOrganizationId,
      );

      if (!activeMembership) {
        return res.status(403).json({
          status: "error",
          message: "You are not a member of this organization",
        });
      }
    } else if (user.memberships.length === 1) {
      activeMembership = user.memberships[0];
    } else if (user.memberships.length > 1) {
      return res.status(409).json({
        status: "error",
        message: "Select an active organization",
        organizations: user.memberships.map((membership) => ({
          id: membership.organizationId,
          name: membership.organization.name,
          role: membership.role,
        })),
      });
    }

    req.user = {
      id: user.id,
      sessionId: session.id,
      accountRole: user.role,
      organizationId: activeMembership?.organizationId || null,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: activeMembership?.role || "REPORTER",
      teamId: activeMembership?.teamId || null,
      organization: activeMembership?.organization || null,
      memberships: user.memberships,
    };

    next();
  } catch (error) {
    console.error("Authentication lookup error:", error);

    return res.status(500).json({
      status: "error",
      message: "Unable to verify user account",
    });
  }
}