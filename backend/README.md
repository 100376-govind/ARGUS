# ARGUS Backend

**AI-Powered Multi-Agent Crisis Command Platform — Backend API Server**

Production-grade Next.js 15 API server implementing Clean Architecture with multi-agent AI orchestration via Google Gemini 2.5 Pro.

---

## Architecture

```
backend/src/
├── app/api/           → Next.js App Router API route handlers
├── application/       → Use cases & agent services
│   ├── agents/        → Data Dispatcher service
│   └── shared-memory/ → Multi-agent shared incident memory
├── domain/            → Entities, repository contracts, service interfaces
│   ├── entities/      → IncidentEntity, value types
│   ├── repositories/  → IIncidentRepository
│   └── services/      → IAIClient, IEventBus, IMediaService
├── infrastructure/    → External adapters
│   ├── database/      → Prisma client & repository implementation
│   ├── firebase/      → Firebase Cloud Storage media service
│   ├── gemini/        → Google Gemini AI client (structured output)
│   ├── logger/        → Pino structured logger
│   └── redis/         → Redis pub/sub event bus
├── presentation/      → Middleware (error handler, auth)
└── shared/            → Config, validation schemas, errors, DI container
```

## Key Design Decisions

- **Clean Architecture**: Domain layer has zero external dependencies. Infrastructure adapters implement domain interfaces.
- **Shared Incident Memory**: Multi-agent coordination layer. Any agent can read/write to an incident's execution history without coupling to other agents.
- **Structured AI Output**: Gemini client uses `responseMimeType: "application/json"` with `responseSchema` to guarantee valid JSON — no regex parsing.
- **Audit Trail**: Every mutation is tracked with versioning, changedBy attribution, and immutable history.
- **Event-Driven**: Redis pub/sub broadcasts `IncidentCreated` events. Falls back to in-memory EventEmitter if Redis is unavailable.

## API Endpoints

| Method   | Path                              | Auth     | Description                              |
|----------|-----------------------------------|----------|------------------------------------------|
| `GET`    | `/api/health`                     | Public   | System health check                      |
| `GET`    | `/api/docs`                       | Public   | OpenAPI 3.1 specification                |
| `GET`    | `/api/incidents`                  | Clerk    | List incidents (filterable, paginated)    |
| `GET`    | `/api/incidents/:id`              | Clerk    | Get incident by ID                       |
| `PATCH`  | `/api/incidents/:id`              | Clerk    | Update incident fields                   |
| `DELETE` | `/api/incidents/:id`              | Clerk    | Soft-delete incident                     |
| `POST`   | `/api/incidents/text`             | Clerk    | Submit text incident report              |
| `POST`   | `/api/incidents/audio`            | Clerk    | Submit audio file (transcription)        |
| `POST`   | `/api/incidents/image`            | Clerk    | Submit image (multimodal analysis)       |
| `POST`   | `/api/incidents/video`            | Clerk    | Submit video file                        |
| `POST`   | `/api/incidents/webhook`          | Public   | External integration webhook             |
| `POST`   | `/api/incidents/bulk`             | Clerk    | Batch-create text incidents              |
| `GET`    | `/api/incidents/:id/agent-chain`  | Clerk    | Agent execution history                  |

## Tech Stack

| Layer           | Technology                                         |
|-----------------|---------------------------------------------------|
| Framework       | Next.js 15 (App Router)                           |
| Language        | TypeScript 5.7 (strict mode)                      |
| Database        | PostgreSQL via Prisma ORM                         |
| AI              | Google Gemini 2.5 Pro (`@google/generative-ai`)   |
| Storage         | Firebase Cloud Storage (`firebase-admin`)         |
| Event Bus       | Redis Pub/Sub (`ioredis`)                         |
| Auth            | Clerk (`@clerk/nextjs`)                           |
| Validation      | Zod                                               |
| Logging         | Pino                                              |
| Testing         | Vitest                                            |

## Setup

```bash
# 1. Install dependencies
cd backend
npm install

# 2. Configure environment
cp .env.example .env
# Fill in real values in .env

# 3. Generate Prisma client
npx prisma generate

# 4. Run database migrations
npx prisma migrate dev --name init

# 5. Start development server
npm run dev
# → http://localhost:3001

# 6. Run tests
npm test
```

## Database Schema

6 tables: `Incident`, `Reporter`, `Media`, `AgentExecution`, `AuditLog`, `SystemEvent`, `WebhookLog`

```bash
# View schema visually
npx prisma studio
```

## Multi-Agent Pipeline

```
Input (text/audio/image/video/webhook)
  │
  ▼
Data Dispatcher Agent
  ├── Gemini AI normalization (structured JSON output)
  ├── Firebase media upload (audio/image/video)
  ├── Entity extraction (locations, hazards, people, vehicles, orgs)
  ├── Geolocation extraction
  ├── Confidence scoring
  ├── Database persistence (Prisma)
  ├── Shared Memory write (agent execution record)
  └── Event broadcast (Redis → IncidentCreated)
  │
  ▼
[Future: Risk Evaluator Agent → Field Validator Agent → Resource Allocator Agent]
```
