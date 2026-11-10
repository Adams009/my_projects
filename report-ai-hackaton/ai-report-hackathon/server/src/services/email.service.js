import nodemailer from "nodemailer";

let transporter;

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } =
    process.env;
  if (
    !SMTP_HOST?.trim() ||
    !SMTP_PORT?.trim() ||
    !SMTP_USER?.trim() ||
    !SMTP_PASSWORD?.trim() ||
    !SMTP_FROM?.trim()
  ) {
    throw new Error("SMTP email delivery is not fully configured");
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    // requireTLS: Number(SMTP_PORT) !== 465,
    // connectionTimeout: 10_000,
    // greetingTimeout: 10_000,
    // socketTimeout: 15_000,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASSWORD,
    },
  });

  return transporter;
}

export async function verifyEmailTransport() {
  const mailTransporter = getTransporter();
  await mailTransporter.verify();
}

export async function sendEmail({ to, subject, text }) {
  const mailTransporter = getTransporter();

  await mailTransporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    text,
  });

  return true;
}

export function getClientUrl(pathname, token) {
  const baseUrl = process.env.CLIENT_URL || "http://localhost:5173";
  const url = new URL(pathname, baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}
