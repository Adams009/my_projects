import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { getAllowedOrigins } from "./config/environment.js";
import { prisma } from "./lib/prisma.js";
import authRouter from "./routes/auth.routes.js";
import organizationRouter from "./routes/organization.routes.js";
import reportRouter from "./routes/report.routes.js";

const app = express();
const allowedOrigins = getAllowedOrigins();

app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS || 0));
app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin is not allowed by CORS"));
    },
  }),
);
app.use(express.json({ limit: "16kb", strict: true }));
app.use(cookieParser());

app.use("/api/auth", authRouter);
app.use("/api/organizations", organizationRouter);
app.use("/api/reports", reportRouter);

app.get("/api/health/live", (req, res) => {
  return res.json({ status: "ok" });
});

app.get("/api/health/ready", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return res.json({
      status: "ok",
      database: "connected",
    });
  } catch (error) {
    console.error("Readiness check failed:", error);
    return res.status(503).json({
      status: "error",
      message: "Service is not ready",
    });
  }
});

app.get("/api/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({
      status: "ok",
      message: "CivicFix API is running",
      db: "connected",
    });
  } catch (error) {
    console.error("Health check failed:", error);
    return res.status(503).json({
      status: "error",
      message: "Service is not ready",
    });
  }
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error?.type === "entity.parse.failed") {
    return res.status(400).json({
      status: "error",
      message: "Request body contains invalid JSON",
    });
  }

  if (error?.type === "entity.too.large") {
    return res.status(413).json({
      status: "error",
      message: "Request body is too large",
    });
  }

  if (error?.message === "Origin is not allowed by CORS") {
    return res.status(403).json({
      status: "error",
      message: "Origin is not allowed",
    });
  }

  console.error("Unhandled request error:", error);
  return res.status(500).json({
    status: "error",
    message: "Internal server error",
  });
});

export default app;