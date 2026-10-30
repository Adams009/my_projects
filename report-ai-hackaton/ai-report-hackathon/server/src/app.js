import express from "express";
import cors from "cors";
import pool from "./config/db.js";

const app = express();
app.use(cors());
app.use(express.json());


app.get("/api/health", async (req, res) => {
    try {
    const result = await pool.query("SELECT 1");

    res.json({
      status: "ok",
      message: "CivicFix API is running",
      db: "connected",
      queryResult: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Database connection failed",
      error: error.message,
    });
  }
});

export default app;