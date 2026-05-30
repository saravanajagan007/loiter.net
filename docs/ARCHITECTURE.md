# Loiter.net - Production-Grade SaaS Architecture

This document serves as the comprehensive architectural and technical specification for Loiter.net, a scalable, AI-powered social media content automation platform.

## 1. Complete System Architecture

Loiter.net is built on a modern, decoupled architecture designed for high availability and horizontal scaling:

- **Frontend:** Next.js 16 (React 19) App Router, providing a responsive, server-side rendered dashboard, utilizing TailwindCSS and shadcn/ui.
- **Backend (API Layer):** Next.js Server Actions and Route Handlers for tight coupling with the frontend, abstracting microservice-like layers.
- **Database Layer:** MySQL 8.0 managed via Prisma ORM for strong relational integrity, tenant isolation, and transactional safety.
- **Queue/Worker Layer:** BullMQ backed by Redis for handling asynchronous, distributed background tasks (content fetching, AI processing, publishing).
- **AI Integration Layer:** Pluggable provider pattern (currently OpenAI) orchestrating prompt templates and structured JSON responses.
- **Infrastructure:** Dockerized containers orchestrated via Kubernetes (K8s) for robust container management.

## 2. Folder Structure

```
/src
  /app                  # Next.js App Router (UI & API endpoints)
    /(dashboard)        # Protected tenant views (Studio, Analytics, Settings)
    /api                # REST API / OAuth callbacks
  /components           # Reusable UI components (shadcn, forms, layouts)
  /lib                  # Core utilities (Auth, Prisma client, Redis client)
  /services             # Domain-specific microservice abstractions
    /ai                 # AI providers (OpenAI) and prompts
    /billing            # Stripe integration logic
    /queue              # BullMQ queue definitions and workers
    /social             # Platform adapters (X, LinkedIn, etc.)
/prisma                 # Database schema and migrations
/k8s                    # Kubernetes deployment manifests
/docs                   # Architectural documentation
```

## 3 & 4. Database Schema & Prisma Models

The data layer employs strict multi-tenant isolation. Core models include:
- `Organization` & `Workspace`: Isolates tenant data and billing.
- `User` & `OrgMembership`: Handles RBAC (Role-Based Access Control).
- `SocialAccount`: Securely stores OAuth tokens per platform.
- `ContentSource`: Defines polling targets (Handles, Hashtags).
- `CollectedPost` -> `GeneratedPost` -> `QueuedPost` -> `PublishedPost`: The core content lifecycle pipeline.
- `Subscription`, `ApiKey`, `Notification`, `AuditLog`: Enterprise scalability tables.

*See `prisma/schema.prisma` for the exact entity relationships and index configurations.*

## 5. API Design

RESTful endpoints utilizing Next.js Route Handlers (`/api/*`):
- `GET /api/social/callback/[platform]`: Handles OAuth 2.0 PKCE token exchanges.
- `POST /api/webhooks/stripe`: Manages asynchronous billing events (subscriptions, payments).
- Server Actions (`/src/app/(dashboard)/*/actions.ts`): Act as internal RPCs for the frontend to securely trigger database mutations and queue additions without exposing public API surface area unnecessarily.

## 6 & 7. Queue Architecture & Microservice Breakdown

We use a modular monolith pattern where distinct "services" act as logical microservices, scaled via background workers.
**BullMQ Queues:**
1. `content-fetcher`: Polls `ContentSource` targets via social APIs, deduplicates, and saves to `CollectedPost`.
2. `ai-processor`: Takes a `CollectedPost`, applies the selected tone/prompt via the `ai` service, and saves a `GeneratedPost`.
3. `post-publisher`: Monitors the `QueuedPost` table and publishes content exactly at `scheduledFor`. Handles rate-limiting and robust retry mechanisms (Exponential backoff).

## 8 & 9. Authentication & OAuth Implementation

- **Platform Auth:** Handled via Auth.js (NextAuth) using Google OAuth and JWT sessions. Event listeners auto-provision a default `Organization` and `Workspace`.
- **Social Connect (OAuth 2.0):** The `SocialProvider` interface handles platform-specific OAuth (e.g., `XProvider`). It uses the PKCE flow, storing `state` and `code_verifier` securely in `httpOnly` cookies during the redirect phase, exchanging them for long-lived `accessToken` and `refreshToken` in the callback.

## 10. Scheduler Implementation

- **Smart Queueing:** Approved `GeneratedPosts` are moved to `QueuedPost` with a specific `scheduledFor` timestamp.
- **Worker Execution:** The `post-publisher` worker queries for tasks where `scheduledFor <= now()`.
- **Failure Recovery:** If a publish fails, the queue increments `attempts`, logs the `errorMessage`, and updates status to `FAILED`. A Dead Letter Queue (DLQ) mechanism can re-process or alert users.

## 11. AI Rewriting Pipeline

- **Pluggable Architecture:** `OpenAIProvider` implements `AIProvider`.
- **Execution:** Uses `gpt-4o-mini` with strict `response_format: { type: "json_object" }` to ensure structured outputs (content, hashtags).
- **Tone Management:** Users pass a `tone` flag (e.g., "viral", "professional") which injects specific instructions into the system prompt.

## 12, 13, & 14. DevOps, Docker, CI/CD, & Deployment

- **Docker:** Multi-stage `Dockerfile` optimizes the Next.js standalone build for minimal image size.
- **CI/CD:** Designed for GitHub Actions. Runs `npm run lint`, `npm run build`, builds the Docker image, and pushes to a container registry (e.g., GHCR, ECR).
- **Kubernetes (K8s):** Scalable deployments utilizing ConfigMaps for secrets, Deployments for the Next.js app and Worker processes, and Services for internal networking. (See `/k8s` directory).
- **Monitoring:** Ready for Prometheus/Grafana via standard `/metrics` endpoints.

## 15. SaaS Billing Integration

- **Stripe:** The `Subscription` table maps to Stripe Customer and Subscription IDs.
- **Webhooks:** Stripe webhooks sync subscription tier changes (Free, Pro, Enterprise) to the database, enforcing usage limits (e.g., max social accounts, max AI tokens).

## 16. Security Checklist

- [x] **RBAC:** `OrgRole` (OWNER, ADMIN, MEMBER) enforced at the database and action layer.
- [x] **Token Security:** OAuth tokens stored in DB; session tokens are secure `httpOnly` cookies.
- [x] **Injection Prevention:** Prisma ORM completely prevents SQL injection.
- [x] **XSS Protection:** React/Next.js automatically escapes JSX interpolation.
- [x] **CSRF Protection:** Next.js Server Actions include native CSRF protection.
- [x] **Audit Logging:** `AuditLog` table tracks all destructive actions (deletions, connections).

## 17. Testing Strategy

- **Unit Tests:** Jest/Vitest for testing individual service logic (`XProvider`, AI prompts).
- **Integration Tests:** Testing API routes and Server Actions against a test database.
- **E2E Tests:** Playwright or Cypress for testing the full OAuth flow, dashboard rendering, and scheduling UI.

## 18. Scaling Strategy

- **Stateless API:** The Next.js container is entirely stateless, allowing infinite horizontal scaling.
- **Worker Scaling:** BullMQ workers can be scaled independently of the web API based on queue depth metrics.
- **Database:** Read-replicas for heavy dashboard queries; connection pooling (PgBouncer/Prisma Accelerate) for high concurrency.
- **Caching:** Redis acts as both the job queue backend and the primary cache for rate-limiting and session validation.
