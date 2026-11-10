import crypto from "node:crypto";
import jwt from "jsonwebtoken";

export const ACCESS_TOKEN_TTL = "15m";
export const REFRESH_TOKEN_TTL = "30d";

const TOKEN_ISSUER = "civicfix-api";
const TOKEN_AUDIENCE = "civicfix-client";

function getAccessTokenSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return secret;
}

function getRefreshTokenSecret() {
  const secret = process.env.JWT_REFRESH_SECRET;

  if (!secret) {
    throw new Error("JWT_REFRESH_SECRET is not configured");
  }

  return secret;
}

export function createRefreshToken(user, tokenId) {
  return jwt.sign(
    {
      sub: user.id,
      tokenType: "refresh",
      tokenId,
    },
    getRefreshTokenSecret(),
    {
      algorithm: "HS256",
      audience: TOKEN_AUDIENCE,
      expiresIn: REFRESH_TOKEN_TTL,
      issuer: TOKEN_ISSUER,
    },
  );
}

export function createAccessToken(user, sessionId) {
  return jwt.sign(
    {
      sub: user.id,
      tokenType: "access",
      sessionId,
    },
    getAccessTokenSecret(),
    {
      algorithm: "HS256",
      audience: TOKEN_AUDIENCE,
      expiresIn: ACCESS_TOKEN_TTL,
      issuer: TOKEN_ISSUER,
    },
  );
}

export function verifyRefreshToken(refreshToken) {
  return jwt.verify(refreshToken, getRefreshTokenSecret(), {
    algorithms: ["HS256"],
    audience: TOKEN_AUDIENCE,
    issuer: TOKEN_ISSUER,
  });
}

export function verifyAccessToken(accessToken) {
  return jwt.verify(accessToken, getAccessTokenSecret(), {
    algorithms: ["HS256"],
    audience: TOKEN_AUDIENCE,
    issuer: TOKEN_ISSUER,
  });
}

export function hashToken(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function generateRandomToken(size = 32) {
  return crypto.randomBytes(size).toString("hex");
}
