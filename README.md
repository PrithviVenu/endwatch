# Endwatch — URL Health Monitoring Platform

A full-stack platform to monitor URL health, track uptime, and visualize response times across your endpoints.

## Quick Start
```bash
git clone https://github.com/PrithviVenu/endwatch.git
cd endwatch
cp backend/.env.example backend/.env
docker-compose up --build
```
Open http://localhost:5173

## Tech Stack
| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React + Vite, Tailwind CSS, Recharts, Lucide React | Dashboard UI |
| Backend | Node.js, Express.js | REST API |
| Database | PostgreSQL via Prisma ORM | Persistent storage |
| Queue | Bull + Redis | Background job scheduling |
| Logging | Winston | Structured observability |
| Auth | JWT access + refresh tokens | Secure authentication |
| Infrastructure | Docker + Docker Compose | Containerized deployment |

## Architecture Overview
Endwatch is built around a straightforward flow: a user interacts with a React dashboard, which uses an Axios client to send authenticated requests to an Express REST API. Every protected request is validated by JWT middleware, ensuring only authorized users can access their monitored URLs and results.

URL checks can be triggered manually via the API or automatically via a node-cron scheduler that runs every minute. The monitor engine runs all checks concurrently using Promise.allSettled, so one failing URL never blocks the rest of the batch. Check results are persisted to PostgreSQL via Prisma, with indexes on urlId and checkedAt to keep history and aggregation queries fast as data grows.

Bull, backed by Redis, manages background job distribution so check execution is decoupled from the request lifecycle. Winston logs all system events using correlation IDs and structured JSON, making it easier to trace behavior across requests, scheduled runs, and queue workers.

## Design Decisions & Tradeoffs

### Prisma over raw SQL
Type safety, auto-completion, and migration management out of the box.
Schema.prisma serves as single source of truth for the database structure.
Tradeoff: slight abstraction overhead vs raw SQL for complex queries.

### Promise.allSettled for concurrency
Checks N URLs simultaneously instead of sequentially. allSettled ensures
one failing URL never aborts the rest of the batch.
Tradeoff: all checks fire at once — at scale this needs throttling
with a concurrency limiter.

### Polling over WebSockets
30-second polling provides a near-real-time feel while staying simple
to implement and debug. Sufficient for check intervals of 1-5 minutes.
Tradeoff: slight latency vs true real-time, minor extra server load.

### Bull queue for background jobs
Decouples check execution from the API request lifecycle. Supports
retries, job prioritization, and horizontal scaling by spinning up
additional workers without changing core logic.
Tradeoff: adds Redis as a required dependency.

### JWT stateless authentication
Scales horizontally — any server instance can verify tokens without
shared state. 15-minute access tokens with 7-day refresh tokens
balance security and user experience.
Tradeoff: no instant token revocation without a Redis blacklist.

### Indexes on CheckResult(urlId, checkedAt)
History queries filter by urlId and sort by checkedAt. Without this
index every history query is a full table scan — unacceptable at scale.

## How AI Was Used

AI was used as a development accelerator throughout this project.

The core architecture — stack selection, database schema, concurrency
model, authentication strategy, and queue design — were decided based on the system requirements. AI tooling was leveraged to accelerate implementation.

**Claude** served as a technical sounding board during the design phase,
validating architectural choices and surfacing tradeoffs before
implementation began.

**Cursor** was integrated as an AI-powered editor throughout development,
speeding up implementation while the codebase and architectural intent
were maintained end to end.

## Scaling to 10,000 URLs

The current architecture handles hundreds of URLs comfortably on a
single worker. To scale to 10,000+:

1. **Horizontal worker scaling** — Bull natively supports multiple
   concurrent workers across machines. Scale by adding workers without
   touching core logic.
2. **Redis caching** — Cache the /stats endpoint and invalidate on new
   check results. Eliminates DB hit on every dashboard load.
3. **DB partitioning** — Partition CheckResult by date. Recent data
   queries stay fast as history accumulates.
4. **Connection pooling** — PgBouncer in front of PostgreSQL handles
   high concurrency without exhausting connections.
5. **Regional distribution** — Deploy workers in multiple regions for
   accurate global uptime measurement and reduced latency.
6. **Concurrency throttling** — Limit simultaneous outbound requests
   per worker to avoid overwhelming target servers.

## Improvements With More Time

- WebSockets for true real-time dashboard updates
- Email and Slack alerts when a URL goes DOWN
- Retry with exponential backoff on failed checks
- Uptime SLA calculations and exportable reports
- Multi-region check distribution
- Rate limiting per user
- Redis token blacklist for instant JWT revocation
- Scheduled cleanup job for CheckResults older than 90 days

