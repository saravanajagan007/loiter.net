# Loiter.net - Deployment & Setup Guide

Loiter.net is a social media curation and automated publishing platform. It leverages self-hosted Nitter and RSS-Bridge instances to fetch content, process it, and queue/verify published posts using background workers (BullMQ) and Redis.

## System Prerequisites
* **Node.js**: v18.x or v20.x
* **MySQL Database**: A running instance (local or remote)
* **Docker & Docker Compose**: For self-hosting the Nitter scraper, RSS-Bridge, and cache container
* **Process Manager (Optional but recommended)**: PM2 to manage workers and Next.js processes in production

---

## Setup & Deployment Steps (VPS / Production)

### Step 1: Clone and Install Dependencies
Clone the repository and install the Node modules:
```bash
git clone https://github.com/saravanajagan007/loiter.net.git
cd loiter.net
npm install
```

### Step 2: Configure Environment Variables
Create a `.env` file in the project root by copying `.env.example` or creating one manually:
```env
# Database connection (MySQL)
DATABASE_URL="mysql://username:password@ip_or_host:3306/database_name"

# Redis Server connection (used for queue workers)
REDIS_URL="redis://127.0.0.1:6380"

# NextAuth authentication config
AUTH_SECRET="your_nextauth_secret_key"
AUTH_TRUST_HOST=true
NEXTAUTH_URL="http://your-domain.com" # Or http://localhost:3000 for local development

# Scraper Configuration
CONTENT_FETCH_INTERVAL_MINUTES=60
NITTER_INSTANCE_URL="http://localhost:8080"
```

### Step 3: Configure Scraping Sessions
Because Twitter/X requires authentication to scrape public profiles, you must configure a Twitter account session for Nitter:

1. Create a JSON Lines session file at `nitter/sessions.jsonl`.
2. Extract the `auth_token` and `ct0` cookies from a logged-in Twitter account.
3. Save them in `nitter/sessions.jsonl` using the following exact format:
   ```json
   {"kind": "cookie", "username": "your_account_username", "id": "12345678", "auth_token": "YOUR_AUTH_TOKEN", "ct0": "YOUR_CT0_COOKIE"}
   ```
   *(Note: The `"kind": "cookie"` and a unique numeric `"id"` are required fields for the Nitter parser).*

### Step 4: Run Scraper Infrastructure
Start the scraper services (Redis, Nitter, and RSS-Bridge) via Docker Compose:
```bash
docker-compose up -d --build
```
Verify the scraping infrastructure is working:
* Nitter dashboard is accessible at `http://localhost:8080`
* RSS-Bridge is accessible at `http://localhost:3002`

### Step 5: Database Setup
Apply database changes and generate the Prisma Client:
```bash
npx prisma db push
```

### Step 6: Start Application Processes
For production deployments, it is recommended to run processes using a process manager like **PM2** so that they restart automatically on crash or reboot.

#### A. Install PM2 Globally (if not already installed)
```bash
npm install -g pm2
```

#### B. Start Next.js App
First, build the production bundle:
```bash
npm run build
```
Start the application process:
```bash
pm2 start npm --name "loiter-web" -- start
```

#### C. Start Background Workers
Start the queue processor workers (used for fetching feeds, AI generation fallbacks, and publishing verifications):
```bash
pm2 start npm --name "loiter-workers" -- run workers
```

#### D. Monitor Running Processes
Check status and logs of your PM2 processes:
```bash
pm2 list
pm2 logs
```

---

## Local Development Flow
If running locally for testing:
1. Ensure your local Docker Desktop is running and start services: `docker-compose up -d`.
2. Run database setup: `npx prisma db push`.
3. In separate terminals, run:
   * Web client: `npm run dev`
   * Background workers: `npm run workers`
