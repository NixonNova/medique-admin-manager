# Medique Admin Manager

The operations desk for a clinic group. Platform admins, clinic admins, and doctors sign in to the same app, and the role decides the view: the whole organization, one clinic's branch, or a single person's diary.

Three jobs live here.

**Accounts.** The organization is a tree. A platform admin adds clinic admins. A clinic admin adds the doctors and staff beneath them, marks each person as Staff Admin or Doctor, and keeps clinic names and addresses next to the people who work there.

**Working days.** A diary comes from a weekly pattern. Pick a clinic, the weekdays that are open, and the length of each session. The app generates the working days and every bookable time slot. Open a day to see the practitioner and the patients in each slot.

**Bookings.** Appointments line up by date, clinic, and practitioner. A visit that passed without verification is flagged as expired, and staff can verify a booking from the same list.

Next.js admin web app. Local development uses the Next.js dev server. Vercel can host it as-is. The Docker image is for moving to another host later.

## Tech stack

- **App:** Next.js 16 (App Router), React 19, TypeScript
- **UI:** Material UI 9 (Emotion), MUI X Tree View and Scheduler, Tailwind CSS 4
- **Auth:** Better Auth
- **Data:** Neon Postgres, accessed with `pg` and Kysely
- **Tooling:** ESLint, Docker (standalone Next.js output)

## Run locally

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and set `BETTER_AUTH_SECRET` and `DATABASE_URL`. The first start creates the platform admin `admin@medique.id` if that account does not exist yet.

Open [http://localhost:3000](http://localhost:3000). Unauthenticated visits go to the sign-in page.

The app reads and writes Neon Postgres (database name **medique-db**). `DATABASE_URL` is required.

## Production on Vercel

Connect this repository in Vercel. The platform detects Next.js and runs `npm run build`. No extra config is required.

## Run with Docker

Use this when the app moves off Vercel onto any host that runs containers.

```bash
docker compose up --build
```

The app listens on [http://localhost:3000](http://localhost:3000). The image uses Next.js `output: "standalone"`, so the container ships only the files the server needs.
