# CivicFix web client

## Local development

Run the API on port 5000 and the client with `npm run dev`. In development, the client uses `http://localhost:5000/api` by default. To use a different API, set `VITE_API_URL` in a local `.env` file; see `.env.example`.

## Production deployment

Set `VITE_API_URL` before building if the API is on a different origin, for example `https://api.example.com/api`. If the web host proxies `/api` to the backend on the same origin, leave it unset; production defaults to `/api`.

The client uses an HttpOnly refresh-token cookie and keeps access tokens in JavaScript memory rather than persistent browser storage. The browser must be able to send credentials to the API. Configure the API CORS origin and cookie `SameSite`/`Secure` settings to match the deployment, and serve both sites over HTTPS. Configure the web host to return the SPA entry point for routes such as `/login`, `/accept-invitation`, `/forgot-password`, and `/reset-password`.
