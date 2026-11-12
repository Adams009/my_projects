import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "node:http";
process.env.NODE_ENV = "test";
const { default: app } = await import("../src/app.js");
import {
  createAccessToken,
  createRefreshToken,
  hashToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "../src/services/token.service.js";
import {
  loginSchema,
  registerReporterSchema,
  createInvitationSchema,
  updateProfileSchema,
} from "../src/schemas/auth.schema.js";
import {
  createOrganizationLocationSchema,
  updateOrganizationLocationSchema,
  updateOrganizationMemberSchema,
} from "../src/schemas/organization.schema.js";
import {
  assignReportSchema,
  createTeamSchema,
} from "../src/schemas/report.schema.js";
import { validateEnvironment } from "../src/config/environment.js";
import {
  sendEmail,
  verifyEmailProvider,
} from "../src/services/email.service.js";

process.env.JWT_SECRET = "access-test-secret-that-is-long-enough-123456";
process.env.JWT_REFRESH_SECRET = "refresh-test-secret-that-is-different-123456";

let server;
let baseUrl;

before(async () => {
  server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("access and refresh tokens are distinct, typed, and session-bound", () => {
  const user = { id: "test-user" };
  const accessToken = createAccessToken(user, "test-session");
  const refreshToken = createRefreshToken(user, "test-session");

  assert.equal(verifyAccessToken(accessToken).tokenType, "access");
  assert.equal(verifyAccessToken(accessToken).sessionId, "test-session");
  assert.equal(verifyRefreshToken(refreshToken).tokenType, "refresh");
  assert.throws(() => verifyAccessToken(refreshToken));
  assert.throws(() => verifyRefreshToken(accessToken));
  assert.notEqual(hashToken(accessToken), accessToken);
});

test("registration and password changes require 8 characters and login stays compatible", () => {
  const registration = {
    firstName: "Ada",
    lastName: "Fixer",
    email: "ADA@example.com",
    password: "seven!!",
  };
  assert.equal(registerReporterSchema.safeParse(registration).success, false);
  const validRegistration = registerReporterSchema.safeParse({
    ...registration,
    password: "eight!!!",
  });
  assert.equal(validRegistration.success, true);
  assert.equal(validRegistration.data.email, "ada@example.com");
  assert.equal(loginSchema.safeParse({
    email: "ada@example.com",
    password: "old-password",
  }).success, true);
});

test("team creation and team-member invitations validate required team data", () => {
  assert.equal(assignReportSchema.safeParse({}).success, false);
  assert.equal(
    assignReportSchema.safeParse({
      teamId: "00000000-0000-4000-8000-000000000001",
    }).success,
    true,
  );
  assert.equal(createTeamSchema.safeParse({ name: " " }).success, false);
  assert.equal(
    createTeamSchema.safeParse({
      name: "Building Maintenance",
      description: "Repairs buildings",
    }).success,
    true,
  );
  assert.equal(
    createInvitationSchema.safeParse({
      email: "worker@example.com",
      role: "TEAM_MEMBER",
      teamId: "team-id",
    }).success,
    true,
  );
  assert.equal(
    createInvitationSchema.safeParse({
      email: "worker@example.com",
      role: "TEAM_MEMBER",
    }).success,
    false,
  );
  assert.equal(
    createInvitationSchema.safeParse({
      email: "worker@example.com",
      role: "SUPERVISOR",
      teamId: "team-id",
    }).success,
    false,
  );
});

test("profile and organization member updates validate password and team requirements", () => {
  assert.equal(
    updateProfileSchema.safeParse({
      firstName: "Ada",
      lastName: "Fixer",
    }).success,
    true,
  );
  assert.equal(
    updateProfileSchema.safeParse({
      firstName: "Ada",
      lastName: "Fixer",
      newPassword: "a-new-password-long-enough",
    }).success,
    false,
  );
  assert.equal(
    updateProfileSchema.safeParse({
      firstName: "Ada",
      lastName: "Fixer",
      currentPassword: "current-password",
      newPassword: "eight!!!",
    }).success,
    true,
  );
  assert.equal(
    updateProfileSchema.safeParse({
      firstName: "Ada",
      lastName: "Fixer",
      currentPassword: "current-password",
      newPassword: "seven!!",
    }).success,
    false,
  );
  assert.equal(
    updateOrganizationMemberSchema.safeParse({
      role: "TEAM_MEMBER",
      teamId: "team-id",
    }).success,
    true,
  );
  assert.equal(
    updateOrganizationMemberSchema.safeParse({
      role: "TEAM_MEMBER",
    }).success,
    false,
  );
  assert.equal(
    updateOrganizationMemberSchema.safeParse({
      role: "SUPERVISOR",
      teamId: "team-id",
    }).success,
    false,
  );
});

test("organization location schemas validate names, descriptions, and lifecycle changes", () => {
  assert.equal(
    createOrganizationLocationSchema.safeParse({
      name: "  Main Office  ",
      description: "",
    }).data?.name,
    "Main Office",
  );
  assert.equal(
    createOrganizationLocationSchema.safeParse({ name: "x" }).success,
    false,
  );
  assert.equal(
    updateOrganizationLocationSchema.safeParse({
      name: "Main Office",
      description: "First floor",
      isActive: false,
    }).success,
    true,
  );
  assert.equal(
    updateOrganizationLocationSchema.safeParse({
      name: "Main Office",
      isActive: "false",
    }).success,
    false,
  );
});

test("email delivery rejects incomplete Brevo configuration", async () => {
  const brevoNames = [
    "BREVO_API_KEY",
    "BREVO_SENDER_EMAIL",
  ];
  const originalValues = Object.fromEntries(
    brevoNames.map((name) => [name, process.env[name]]),
  );

  try {
    for (const name of brevoNames) {
      delete process.env[name];
    }

    await assert.rejects(
      sendEmail({
        to: "recipient@example.com",
        subject: "Test",
        text: "Test",
      }),
      /Brevo is not configured correctly/,
    );
    await assert.rejects(
      verifyEmailProvider(),
      /Brevo is not configured correctly/,
    );
  } finally {
    for (const name of brevoNames) {
      if (originalValues[name] === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = originalValues[name];
      }
    }
  }
});

test("Brevo verification and email delivery use the HTTP API", async () => {
  const brevoNames = ["BREVO_API_KEY", "BREVO_SENDER_EMAIL"];
  const originalValues = Object.fromEntries(
    brevoNames.map((name) => [name, process.env[name]]),
  );
  const originalFetch = globalThis.fetch;
  const requests = [];

  process.env.BREVO_API_KEY = "test-api-key";
  process.env.BREVO_SENDER_EMAIL = "no-reply@example.com";
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return new Response("{}", {
      status: url.endsWith("/account") ? 200 : 201,
    });
  };

  try {
    assert.equal(await verifyEmailProvider(), true);
    assert.equal(
      await sendEmail({
        to: "recipient@example.com",
        subject: "Test",
        text: "Test message",
      }),
      true,
    );

    assert.equal(requests[0].url, "https://api.brevo.com/v3/account");
    assert.equal(requests[0].options.headers["api-key"], "test-api-key");
    assert.equal(requests[1].url, "https://api.brevo.com/v3/smtp/email");
    assert.deepEqual(JSON.parse(requests[1].options.body), {
      sender: { email: "no-reply@example.com", name: "CivicFix" },
      to: [{ email: "recipient@example.com" }],
      subject: "Test",
      textContent: "Test message",
    });
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of brevoNames) {
      if (originalValues[name] === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = originalValues[name];
      }
    }
  }
});

test("Brevo API failures expose status without returning provider response content", async () => {
  const brevoNames = ["BREVO_API_KEY", "BREVO_SENDER_EMAIL"];
  const originalValues = Object.fromEntries(
    brevoNames.map((name) => [name, process.env[name]]),
  );
  const originalFetch = globalThis.fetch;

  process.env.BREVO_API_KEY = "test-api-key";
  process.env.BREVO_SENDER_EMAIL = "no-reply@example.com";
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ message: "provider diagnostic detail" }), {
      status: 401,
    });

  try {
    await assert.rejects(verifyEmailProvider(), (error) => {
      assert.equal(error.status, 401);
      assert.match(error.message, /status 401/);
      assert.doesNotMatch(error.message, /provider diagnostic detail/);
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of brevoNames) {
      if (originalValues[name] === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = originalValues[name];
      }
    }
  }
});

test("production environment rejects weak or missing deployment configuration", () => {
  const originalEnvironment = { ...process.env };
  try {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "postgresql://db.example/civicfix";
    process.env.JWT_SECRET = "short";
    process.env.JWT_REFRESH_SECRET = "different-short";
    process.env.CORS_ORIGINS = "https://civicfix.example";
    process.env.CLIENT_URL = "https://civicfix.example";
    process.env.BREVO_API_KEY = "test-api-key";
    process.env.BREVO_SENDER_EMAIL = "no-reply@example.com";
    process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
    process.env.CLOUDINARY_API_KEY = "test-key";
    process.env.CLOUDINARY_API_SECRET = "test-secret";

    assert.throws(validateEnvironment, /at least 32 bytes/);

    process.env.JWT_SECRET = "a".repeat(40);
    process.env.JWT_REFRESH_SECRET = "b".repeat(40);
    assert.doesNotThrow(validateEnvironment);
  } finally {
    for (const name of Object.keys(process.env)) {
      if (!(name in originalEnvironment)) {
        delete process.env[name];
      }
    }
    Object.assign(process.env, originalEnvironment);
  }
});

test("HTTP API exposes hardened headers, rejects foreign origins, and handles bad JSON", async () => {
  const liveResponse = await fetch(`${baseUrl}/api/health/live`);
  assert.equal(liveResponse.status, 200);
  assert.equal(liveResponse.headers.get("x-powered-by"), null);
  assert.equal(liveResponse.headers.get("x-content-type-options"), "nosniff");

  const corsResponse = await fetch(`${baseUrl}/api/health/live`, {
    headers: { Origin: "https://untrusted.example" },
  });
  assert.equal(corsResponse.status, 403);

  const jsonResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{invalid json",
  });
  assert.equal(jsonResponse.status, 400);

  const refreshResponse = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: "POST",
    headers: { Origin: "http://localhost:5173" },
  });
  assert.equal(refreshResponse.status, 401);
});
