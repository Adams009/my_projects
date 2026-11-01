import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { loginSchema, registerSchema } from "../schemas/auth.schema.js";

function createAccessToken(user) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign(
    {
      sub: user.id,
      organizationId: user.organizationId,
      role: user.role,
    },
    secret,
    { expiresIn: "1d" },
  );
}

function toPublicUser(user) {
  return {
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
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
    organizationSlug,
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

    const existingOrganization = await prisma.organization.findUnique({
      where: { slug: organizationSlug },
    });

    if (existingOrganization) {
      return res.status(409).json({
        status: "error",
        message: "An organization with this slug already exists",
      });
    }

    const passwordHash = await argon2.hash(password);

    const user = await prisma.$transaction(async (transaction) => {
      const organization = await transaction.organization.create({
        data: {
          name: organizationName,
          slug: organizationSlug,
        },
      });

      return transaction.user.create({
        data: {
          organizationId: organization.id,
          firstName,
          lastName,
          email,
          passwordHash,
          role: "ORGANIZATION_ADMIN",
        },
      });
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
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({
        status: "error",
        message: "Invalid email or password",
      });
    }

    const passwordMatches = await argon2.verify(user.passwordHash, password);

    if (!passwordMatches) {
      return res.status(401).json({
        status: "error",
        message: "Invalid email or password",
      });
    }

    return res.json({
      status: "success",
      message: "Login successful",
      token: createAccessToken(user),
      user: toPublicUser(user),
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      status: "error",
      message: "Unable to log in",
    });
  }
}
