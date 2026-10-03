# Medique Admins Manager

Next.js admin web app. Local development uses the Next.js dev server. Vercel can host it as-is. The Docker image is for moving to another host later.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Production on Vercel

Connect this repository in Vercel. The platform detects Next.js and runs `npm run build`. No extra config is required.

## Run with Docker

Use this when the app moves off Vercel onto any host that runs containers.

```bash
docker compose up --build
```

The app listens on [http://localhost:3000](http://localhost:3000). The image uses Next.js `output: "standalone"`, so the container ships only the files the server needs.
