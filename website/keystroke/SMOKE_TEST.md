# Smoke Test Checklist

This checklist is the baseline regression pass for the Keystroke app on the current `main` branch. It verifies the app can boot, serve the main pages, accept anonymous typing content, log in, and load the dashboard.

## Preconditions

- Node.js 18+
- npm dependencies installed
- `.env` present from `.env.example`

## Baseline checklist

1. Server boots without crashing.
   - Expected: `npm start` starts the Express app and logs the local URL.
2. Homepage loads.
   - Expected: `GET /` returns HTTP 200 and HTML content.
3. Guest can access a typing challenge.
   - Expected: `GET /type.html` returns HTTP 200 and `GET /api/texts/random` returns a valid text payload.
4. Login works.
   - Expected: `POST /api/auth/login` with `admin` / `admin123` returns `200` and sets the auth cookie.
5. Dashboard loads for an authenticated user.
   - Expected: `GET /dashboard` returns HTTP 200 and HTML content.

## Phase 1 hardening checklist

6. Security headers are present in production.
   - Expected: `Content-Security-Policy`, `Strict-Transport-Security`, and `X-Frame-Options` appear on `/healthz` or `/readyz` when `NODE_ENV=production`.
7. Health and readiness endpoints are live.
   - Expected: `/healthz` returns 200 and `/readyz` returns 200 when the DB is available.
8. Login throttling triggers 429 after repeated failures.
   - Expected: multiple bad login attempts eventually return `429 Too Many Requests`.
9. Missing JWT_SECRET fails fast.
   - Expected: startup aborts immediately with a readable error instead of using a silent fallback.
10. Database integrity check passes.
    - Expected: `node scripts/check-db-integrity.js` prints `Database integrity check passed.`

## Recorded result (current run)

Status: PASS

- The server started successfully on `http://localhost:3000`.
- `/` returned HTTP 200.
- `/type.html` returned HTTP 200.
- `/api/texts/random` returned a valid JSON text payload.
- `POST /api/auth/login` with `admin` / `admin123` succeeded.
- `/dashboard` returned HTTP 200 after login.
- `/healthz` returned `200 OK` and included security headers in production mode.
- `/readyz` returned `200 OK` with a valid DB check.
- Repeated bad logins eventually returned `429`.
- Missing `JWT_SECRET` triggered a clear startup validation error.
- `node scripts/check-db-integrity.js` reported a clean database integrity result.

## Commands used

```bash
cp .env.example .env
npm start
curl -I http://localhost:3000/
curl -s http://localhost:3000/api/texts/random
curl -c cookies.txt -s -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"emailOrUsername":"admin","password":"admin123"}'
curl -b cookies.txt -I http://localhost:3000/dashboard
NODE_ENV=production PORT=3002 JWT_SECRET='0123456789abcdef0123456789abcdef' node server.js
curl -I http://localhost:3002/healthz
curl -I http://localhost:3002/readyz
for i in $(seq 1 12); do curl -s -o /tmp/phase1-bad-$i.json -w '%{http_code} ' -X POST http://localhost:3002/api/auth/login -H 'Content-Type: application/json' -d '{"emailOrUsername":"admin","password":"wrong"}'; done
node scripts/check-db-integrity.js
node -e "require('dotenv').config({ override: true }); delete process.env.JWT_SECRET; process.env.NODE_ENV='production'; process.env.PORT='3103'; try { require('./server.js'); } catch (err) { console.log(err.message); }"
```
