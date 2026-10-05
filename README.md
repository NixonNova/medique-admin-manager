# Medique Admin Manager

Next.js admin web app. Local development uses the Next.js dev server. Vercel can host it as-is. The Docker image is for moving to another host later.

## Run locally

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and set `BETTER_AUTH_SECRET` and `ADMIN_INITIAL_PASSWORD`. The first start creates the admin account `nixonnova@outlook.com` when that password is set and the account does not exist yet.

Open [http://localhost:3000](http://localhost:3000). Unauthenticated visits go to the sign-in page.

Accounts are stored in a local SQLite file at `data/auth.sqlite`. That file works for local development and for the Docker volume. Vercel’s filesystem does not keep a SQLite file, so move the database to a hosted Postgres or MySQL database before deploying there.

## Production on Vercel

Connect this repository in Vercel. The platform detects Next.js and runs `npm run build`. No extra config is required.

## Run with Docker

Use this when the app moves off Vercel onto any host that runs containers.

```bash
docker compose up --build
```

The app listens on [http://localhost:3000](http://localhost:3000). The image uses Next.js `output: "standalone"`, so the container ships only the files the server needs.
