import "dotenv/config";
import app from "./app.js";
import { validateEnvironment } from "./config/environment.js";
import { closeRateLimitStores } from "./lib/rate-limit-store.js";
import { prisma } from "./lib/prisma.js";
import { verifyEmailTransport } from "./services/email.service.js";

validateEnvironment();

const PORT = Number(process.env.PORT || 5000);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

async function startServer() {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    const rateLimitTable = await prisma.$queryRaw`
      SELECT to_regclass('public.rate_limit_counters')::text AS table_name
    `;

    if (!rateLimitTable[0]?.table_name) {
      throw new Error(
        'Database migration is missing: run "npm run db:migrate:deploy" before starting the API',
      );
    }
  } catch (error) {
    console.error(
      "CivicFix API startup failed: PostgreSQL is unavailable or its migrations are not applied.",
      error,
    );
    await prisma.$disconnect();
    process.exitCode = 1;
    return;
  }

  try {
    await verifyEmailTransport();
    console.log("SMTP connection verified");
  } catch (error) {
    console.error("SMTP verification failed; email delivery may not work.", {
      code: error?.code,
      command: error?.command,
      responseCode: error?.responseCode,
    });
  }

  const server = app.listen(PORT, () => {
    console.log(`CivicFix API running on port ${PORT}`);
  });

  function shutdown(signal) {
    console.log(`${signal} received; shutting down HTTP server`);
    server.close(async () => {
      closeRateLimitStores();
      await prisma.$disconnect();
      process.exit(0);
    });
  }

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

startServer();