CREATE TABLE "rate_limit_counters" (
    "store_name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "total_hits" INTEGER NOT NULL,
    "reset_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "rate_limit_counters_pkey" PRIMARY KEY ("store_name", "key")
);

CREATE INDEX "rate_limit_counters_reset_at_idx"
    ON "rate_limit_counters"("reset_at");
