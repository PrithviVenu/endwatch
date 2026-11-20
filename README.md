# Endwatch — URL Health Monitoring Platform

A full-stack platform to monitor URL health, track uptime, and visualize response times across your endpoints.

## Quick Start
```bash
git clone [https://github.com/PrithviVenu/endwatch.git](https://github.com/PrithviVenu/endwatch.git)
cd endwatch
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
docker-compose up --build
```

## IMPORTANT: Email setup (Resend)
After running the Quick Start commands above, open `backend/.env` and set a Resend API key for emails to work.

1. Generate an API key at `https://resend.com/api-keys`
2. Add it to `backend/.env`:
   - `RESEND_API_KEY=YOUR_KEY_HERE`

Open http://localhost:5173

Edit `docker-compose.yml` / `frontend/.env` if the API is not at `http://localhost:5001/api` (for example when deploying). Vite reads variables prefixed with `VITE_` at build time.

## Tech Stack
| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React + Vite, Tailwind CSS, Recharts, Lucide React | Dashboard UI |
| Backend | Node.js, Express.js | REST API |
| Database | PostgreSQL via Prisma ORM | Persistent storage |
| Queue | Bull + Redis | Background job scheduling |
| Logging | Winston | Structured observability |
| Auth | JWT access + refresh tokens | Secure authentication |
| Infrastructure | Docker + Docker Compose | Containerized deployment
