const MINIMUM_SECRET_LENGTH = 32;

export function getAllowedOrigins() {
  const configuredOrigins = process.env.CORS_ORIGINS
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configuredOrigins?.length) {
    return configuredOrigins;
  }

  if (process.env.NODE_ENV === "production") {
    return [];
  }

  return ["http://localhost:5173", "http://127.0.0.1:5173"];
}

export function getRefreshCookieOptions() {
  return {
    httpOnly: true,
    secure:
      process.env.NODE_ENV === "production" ||
      process.env.AUTH_COOKIE_SECURE === "true",
    sameSite: (process.env.AUTH_COOKIE_SAME_SITE || "lax").toLowerCase(),
    path: "/api/auth",
  };
}

export function validateEnvironment() {
  const sameSite = (process.env.AUTH_COOKIE_SAME_SITE || "lax").toLowerCase();
  if (!["lax", "strict", "none"].includes(sameSite)) {
    throw new Error("AUTH_COOKIE_SAME_SITE must be lax, strict, or none");
  }

  if (
    sameSite === "none" &&
    process.env.NODE_ENV === "production" &&
    process.env.AUTH_COOKIE_SECURE !== "true"
  ) {
    throw new Error(
      "AUTH_COOKIE_SECURE=true is required when AUTH_COOKIE_SAME_SITE=none",
    );
  }

  const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
  if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0) {
    throw new Error("TRUST_PROXY_HOPS must be a non-negative integer");
  }

  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const requiredValues = [
    "DATABASE_URL",
    "JWT_SECRET",
    "JWT_REFRESH_SECRET",
    "CORS_ORIGINS",
    "CLIENT_URL",
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "SMTP_FROM",
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
  ];
  const missingValues = requiredValues.filter(
    (name) => !process.env[name]?.trim(),
  );

  if (missingValues.length) {
    throw new Error(
      `Missing required production environment variables: ${missingValues.join(", ")}`,
    );
  }

  for (const name of ["JWT_SECRET", "JWT_REFRESH_SECRET"]) {
    if (Buffer.byteLength(process.env[name], "utf8") < MINIMUM_SECRET_LENGTH) {
      throw new Error(`${name} must be at least 32 bytes in production`);
    }
  }

  if (process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
    throw new Error("JWT_SECRET and JWT_REFRESH_SECRET must be different");
  }

  const smtpPort = Number(process.env.SMTP_PORT);
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
    throw new Error("SMTP_PORT must be an integer between 1 and 65535");
  }

  for (const origin of getAllowedOrigins()) {
    let parsedOrigin;

    try {
      parsedOrigin = new URL(origin);
    } catch {
      throw new Error(`Invalid CORS origin: ${origin}`);
    }

    if (parsedOrigin.origin !== origin || parsedOrigin.protocol !== "https:") {
      throw new Error(
        `Production CORS origin must be an HTTPS origin: ${origin}`,
      );
    }
  }

  try {
    const clientUrl = new URL(process.env.CLIENT_URL);
    if (clientUrl.protocol !== "https:") {
      throw new Error("CLIENT_URL must use HTTPS in production");
    }
  } catch {
    throw new Error("CLIENT_URL must be a valid HTTPS URL in production");
  }
}
