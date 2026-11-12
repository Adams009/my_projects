# CivicFix API deployment notes

## Local setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL`, `JWT_SECRET`, and `JWT_REFRESH_SECRET`.
2. Generate two different random JWT secrets of at least 32 bytes (for example, run `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"` twice); do not commit `.env`.
3. Set `SEED_DEMO_PASSWORD` to a private password of at least 8 characters if using `node prisma/seed.js`.
4. Start PostgreSQL and confirm `DATABASE_URL` points to it. Check migration status with `npx prisma migrate status`, apply the reviewed migrations, then start with `npm run dev`. The API checks database connectivity and the rate-limit migration before listening.
5. Seeded demo accounts are for local testing only. Never run the seed script against production.

## Email delivery and account settings

- Configure `BREVO_API_KEY` and `BREVO_SENDER_EMAIL` in the server `.env`. The sender address must be verified in Brevo. Keep the API key private.
- On API startup, the server calls Brevo's account endpoint to verify the API key and logs a safe diagnostic if verification fails. This does not verify inbox delivery.
- Password-reset requests always return a generic confirmation and never return a reset token or link in the API response. If no email arrives locally, inspect the API terminal for `Brevo API verification failed` or `Password reset email delivery failed`; a failed delivery invalidates the reset token.
- An accepted send confirms Brevo accepted the message, not that it reached the inbox. Check Brevo's transactional email activity and the recipient's spam folder if the message is missing.
- Signed-in users can update their first and last name. Changing a password requires the current password and revokes other active refresh sessions. Email changes are unavailable until an email-verification flow is implemented.

## Report images

- Reporters may attach up to five JPEG, PNG, or WebP images to a report. Each image is limited to 5 MB; attachments are optional.
- Configure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in the server `.env`. Keep these values private.
- Uploads are checked by file contents, stored in the `civicfix/reports` Cloudinary folder, and associated with reports in the database. If report creation fails after upload, the API attempts to remove the uploaded Cloudinary images.
- Apply the `20261109223000_add_report_images` migration before using report attachments.

## Production requirements

- Set `NODE_ENV=production` and provide every required setting in `.env.example`, including Brevo and Cloudinary credentials.
- Use separate random JWT secrets of at least 32 bytes, an HTTPS `CLIENT_URL`, and exact HTTPS entries in `CORS_ORIGINS`.
- Use `AUTH_COOKIE_SAME_SITE=lax` for same-site deployments. For cross-site deployments, set `AUTH_COOKIE_SAME_SITE=none` and `AUTH_COOKIE_SECURE=true`; serve the API only over HTTPS.
- Set `TRUST_PROXY_HOPS` only to the exact number of trusted reverse proxies in front of Express. Do not trust arbitrary forwarded headers.
- Run the API behind a TLS-terminating reverse proxy, use a managed PostgreSQL service with backups, and apply reviewed Prisma migrations as a release step.
- Rate limits are stored atomically in PostgreSQL and shared by API instances using the same database. Apply the rate-limit migration before deploying. This avoids separate Redis infrastructure and is suitable for the current MVP scale; expect added database queries, and consider Redis if rate-limit traffic becomes a measurable database bottleneck.
- Any authenticated user can submit a report to any active organization. Staff management actions remain limited to the organization selected through the user's membership. Organization administrators and supervisors can create organization teams; team-member invitations must select one of those teams.
- Organization administrators can list members, change a member's organization role or team, and remove the membership. An administrator cannot remove themselves or demote/remove the last organization administrator; removing a membership does not delete the user's account or past reports.
- Organization administrators can create, edit, deactivate, and reactivate locations in their active organization. Deactivation is reversible and preserves historic report location references; inactive locations are hidden from report forms and rejected for new reports. Active location names are unique within an organization, ignoring letter case.
- Apply the `20261109070000_add_location_lifecycle` migration before using location management.
- Configure monitoring for application errors, email delivery failures, database availability, and rate-limit events. Do not log passwords, authorization headers, reset links, or raw refresh tokens.
- Build and deploy the frontend separately; its origin must match `CORS_ORIGINS`.
- Configure the frontend host to serve the SPA entry point for `/login`, `/accept-invitation`, `/forgot-password`, and `/reset-password`.

The backend uses short-lived access tokens and HttpOnly refresh cookies. Access sessions are checked against the database, so logout and password resets invalidate access immediately. This reduces common risks but does not guarantee vulnerability-free software; keep dependencies patched and perform an independent security review before a public launch.
