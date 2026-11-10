export function requireTrustedOrigin(req, res, next) {
  const origin = req.get("origin");

  if (!origin) {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({
        status: "error",
        message: "A trusted browser origin is required",
      });
    }

    return next();
  }

  const allowedOrigins = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (
    !allowedOrigins.includes(origin) &&
    !(
      process.env.NODE_ENV !== "production" &&
      ["http://localhost:5173", "http://127.0.0.1:5173"].includes(origin)
    )
  ) {
    return res.status(403).json({
      status: "error",
      message: "Untrusted request origin",
    });
  }

  return next();
}
