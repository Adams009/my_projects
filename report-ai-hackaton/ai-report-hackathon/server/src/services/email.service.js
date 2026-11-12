
import "dotenv/config";

const BREVO_API_URL = "https://api.brevo.com/v3";

function getBrevoConfig() {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim();

  if (
    !apiKey ||
    !senderEmail ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)
  ) {
    throw new Error(
      "Brevo is not configured correctly. Check BREVO_API_KEY and BREVO_SENDER_EMAIL.",
    );
  }

  return { apiKey, senderEmail };
}

async function brevoRequest(path, options = {}) {
  const { apiKey } = getBrevoConfig();
  let response;

  try {
    response = await fetch(`${BREVO_API_URL}${path}`, {
      ...options,
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        ...options.headers,
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    const requestError = new Error(
      error?.name === "TimeoutError" || error?.name === "AbortError"
        ? "Brevo API request timed out."
        : "Unable to connect to the Brevo API.",
      { cause: error },
    );
    requestError.code =
      error?.name === "TimeoutError" || error?.name === "AbortError"
        ? "BREVO_TIMEOUT"
        : error?.code || "BREVO_CONNECTION_ERROR";
    throw requestError;
  }

  if (!response.ok) {
    const error = new Error(`Brevo API request failed with status ${response.status}.`);
    error.status = response.status;
    throw error;
  }

  return response;
}

export async function verifyEmailProvider() {
  await brevoRequest("/account");
  return true;
}

export async function sendEmail({
  to,
  subject,
  text,
  html,
}) {
  const { senderEmail } = getBrevoConfig();

  if (
    !to ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) ||
    typeof subject !== "string" ||
    !subject.trim() ||
    (!text && !html)
  ) {
    throw new Error(
      "A valid recipient, subject, and email content are required.",
    );
  }

  await brevoRequest("/smtp/email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: {
        email: senderEmail,
        name: "CivicFix",
      },
      to: [{ email: to }],
      subject,
      ...(text ? { textContent: text } : {}),
      ...(html ? { htmlContent: html } : {}),
    }),
  });

  return true;
}

export function getClientUrl(pathname, token) {
  const baseUrl = process.env.CLIENT_URL?.trim();

  if (!baseUrl) {
    throw new Error("CLIENT_URL is not configured.");
  }

  if (!token) {
    throw new Error("A valid token is required.");
  }

  const base = new URL(baseUrl);

  if (
    base.protocol !== "https:" &&
    base.hostname !== "localhost"
  ) {
    throw new Error("CLIENT_URL must use HTTPS in production.");
  }

  const url = new URL(pathname, base);

  if (url.origin !== base.origin) {
    throw new Error("Invalid client URL path.");
  }

  url.searchParams.set("token", token);

  return url.toString();
}
