# Flexorcist

Personal workout program builder: Bun + Hono API (SQLite) and Expo mobile app.

## Structure

- `server/` — REST API (Bun, Hono, Drizzle, SQLite, JWT single-user auth)
- `mobile/` — Expo Router + NativeWind client

## Server

```bash
cd server
cp .env.example .env   # set JWT_SECRET and GEMINI_API_KEY
bun install
bun run db:migrate
bun run dev
```

API listens on `http://0.0.0.0:3000` by default.

### Auth

- `GET /auth/status` → `{ hasUser }`
- `POST /auth/register` — only when no user exists
- `POST /auth/login` → JWT
- Protected routes need `Authorization: Bearer <token>`

## Mobile

```bash
cd mobile
npm install
npx expo start
```

On first launch, enter the API base URL:

- Simulator / web: `http://localhost:3000`
- Android emulator: `http://10.0.2.2:3000`
- Physical device: `http://<your-lan-ip>:3000`

If the server has no user, registration is shown. Otherwise only login is available.

## Phase 1 notes

- Hierarchy: **Program → Workout → Exercise**
- Programs are max 4 weeks. Adding a training day seeds `home`, `park`, and `gym` workouts.
- `POST /programs/generate` uses Gemini + the saved profile. New movements are stored as exercises (`source: ai`) and reused by name later.
