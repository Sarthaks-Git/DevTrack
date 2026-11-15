# DevTrack

Your developer command center: goals, projects, verified coding stats, journal, and timeline in one place.
Built with React + Vite on the client and Express 5 + MongoDB on the server, with cookie-based JWT auth.

## Run locally

Requires Node 20+ and the MongoDB connection strings in `server/.env` (copy `server/.env.example`).

Open two terminals:

```bash
# Terminal 1: API on http://localhost:5000 (auto-restarts on changes)
cd server
npm install        # first time only
npm run dev

# Terminal 2: web app on http://localhost:5173
cd client
npm install        # first time only
npm run dev
```

Then open **http://localhost:5173**. The Vite dev server proxies `/api` to the API, so both run on one origin.

Stop either server with `Ctrl+C`.

## Checks

```bash
cd server && npm run test:run          # full API test suite (uses the devtrack_test database)
cd client && npx eslint src && npm run build
```

## Databases

| Purpose | Database | Env var |
|---|---|---|
| Development | `devtrack` | `MONGODB_URI` |
| Automated tests (wiped on every run) | `devtrack_test` | `MONGODB_TEST_URI` |
