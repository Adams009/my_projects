import { Router } from "express";
import {
  forgotPassword,
  login,
  logout,
  refreshToken,
  register,
  registerReporter,
  resetPassword,
  acceptInvitation,
  createInvitation,
  listMyInvitations,
  decideInvitation,
  updateProfile,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireTrustedOrigin } from "../middleware/security.middleware.js";
import { rateLimit } from "express-rate-limit";
import { createRateLimitStore } from "../lib/rate-limit-store.js";

const authRouter = Router();
const rateLimitHandler = (req, res) =>
  res.status(429).json({
    status: "error",
    message: "Too many requests. Please try again later.",
  });
const loginLimiter = rateLimit({
  store: createRateLimitStore("auth-login"),
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});
const registrationLimiter = rateLimit({
  store: createRateLimitStore("auth-registration"),
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});
const recoveryLimiter = rateLimit({
  store: createRateLimitStore("auth-recovery"),
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});
const refreshLimiter = rateLimit({
  store: createRateLimitStore("auth-refresh"),
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});
const invitationLimiter = rateLimit({
  store: createRateLimitStore("auth-invitations"),
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});
const profileLimiter = rateLimit({
  store: createRateLimitStore("auth-profile"),
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

authRouter.post("/register", registrationLimiter, register);
authRouter.post("/register/reporter", registrationLimiter, registerReporter);
authRouter.post("/login", loginLimiter, login);
authRouter.post("/refresh", refreshLimiter, requireTrustedOrigin, refreshToken);
authRouter.post("/logout", requireAuth, requireTrustedOrigin, logout);
authRouter.put(
  "/profile",
  requireAuth,
  requireTrustedOrigin,
  profileLimiter,
  updateProfile,
);
authRouter.post("/forgot-password", recoveryLimiter, forgotPassword);
authRouter.post("/reset-password", recoveryLimiter, resetPassword);
authRouter.post(
  "/invitations/accept",
  recoveryLimiter,
  requireTrustedOrigin,
  acceptInvitation,
);
authRouter.post(
  "/invitations",
  requireAuth,
  invitationLimiter,
  createInvitation,
);
authRouter.get("/invitations/mine", requireAuth, listMyInvitations);
authRouter.post(
  "/invitations/:invitationId/decision",
  requireAuth,
  decideInvitation,
);

export default authRouter;
