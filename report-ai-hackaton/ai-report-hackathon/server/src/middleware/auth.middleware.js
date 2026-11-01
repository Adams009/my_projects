import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

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
    payload = jwt.verify(token, secret);
  } catch {
    return res.status(401).json({
      status: "error",
      message: "Invalid or expired token",
    });
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    typeof payload.sub !== "string"
  ) {
    return res.status(401).json({
      status: "error",
      message: "Invalid authentication token",
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: {
        id: payload.sub,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true,
          },
        },
      },
    });

    if (!user || !user.organization.isActive) {
      return res.status(401).json({
        status: "error",
        message: "User account is unavailable",
      });
    }

    req.user = {
      id: user.id,
      organizationId: user.organizationId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      organization: user.organization,
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