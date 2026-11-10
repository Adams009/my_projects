import { prisma } from "./prisma.js";

const stores = new Set();

class PostgreSQLRateLimitStore {
  constructor(name) {
    this.name = name;
    this.prefix = `civicfix:${name}:`;
    this.localKeys = false;
    this.windowMs = 60_000;
    this.cleanupTimer = null;
    stores.add(this);
  }

  init(options) {
    this.windowMs = options.windowMs;
    this.cleanupTimer = setInterval(() => {
      this.pruneExpired().catch((error) => {
        console.error(`Rate-limit cleanup failed for ${this.name}:`, error);
      });
    }, this.windowMs);
    this.cleanupTimer.unref();
  }

  async increment(key) {
    const rows = await prisma.$queryRaw`
      INSERT INTO "rate_limit_counters"
        ("store_name", "key", "total_hits", "reset_at")
      VALUES (
        ${this.name},
        ${key},
        1,
        CURRENT_TIMESTAMP + (${this.windowMs} * INTERVAL '1 millisecond')
      )
      ON CONFLICT ("store_name", "key")
      DO UPDATE SET
        "total_hits" = CASE
          WHEN "rate_limit_counters"."reset_at" <= CURRENT_TIMESTAMP THEN 1
          ELSE "rate_limit_counters"."total_hits" + 1
        END,
        "reset_at" = CASE
          WHEN "rate_limit_counters"."reset_at" <= CURRENT_TIMESTAMP
            THEN CURRENT_TIMESTAMP + (${this.windowMs} * INTERVAL '1 millisecond')
          ELSE "rate_limit_counters"."reset_at"
        END
      RETURNING "total_hits", "reset_at"
    `;
    const row = rows[0];

    return {
      totalHits: Number(row.total_hits),
      resetTime: row.reset_at,
    };
  }

  async decrement(key) {
    await prisma.$executeRaw`
      UPDATE "rate_limit_counters"
      SET "total_hits" = GREATEST("total_hits" - 1, 0)
      WHERE "store_name" = ${this.name}
        AND "key" = ${key}
        AND "reset_at" > CURRENT_TIMESTAMP
    `;
  }

  async resetKey(key) {
    await prisma.$executeRaw`
      DELETE FROM "rate_limit_counters"
      WHERE "store_name" = ${this.name} AND "key" = ${key}
    `;
  }

  async resetAll() {
    await prisma.$executeRaw`
      DELETE FROM "rate_limit_counters" WHERE "store_name" = ${this.name}
    `;
  }

  async pruneExpired() {
    await prisma.$executeRaw`
      DELETE FROM "rate_limit_counters"
      WHERE "store_name" = ${this.name}
        AND "reset_at" <= CURRENT_TIMESTAMP
    `;
  }

  shutdown() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    stores.delete(this);
  }
}

export function createRateLimitStore(name) {
  if (process.env.NODE_ENV === "test") {
    return undefined;
  }

  return new PostgreSQLRateLimitStore(name);
}

export function closeRateLimitStores() {
  for (const store of stores) {
    store.shutdown();
  }
}
