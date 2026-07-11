# ARGUS Risk Evaluator — Presentation, Communication & Protocol Zero Backend

This is the fully completed production-grade backend for the **Risk Evaluator** module of ARGUS (AI-powered Multi-Agent Crisis Command Platform). 

It contains the complete service layer, REST APIs, real-time Socket.io channels, event-driven Redis Pub/Sub flows, commander review workflows (Protocol Zero), concurrency queue processors, observabilities, and Docker build scripts.

---

## 🛠️ Technology Stack
- **Framework**: Next.js 15 (App Router, running standalone Node runner)
- **Database**: PostgreSQL with Prisma ORM
- **Pub/Sub & Caching**: Redis (ioredis)
- **Real-Time Sockets**: Socket.io (Namespaces `/risk`, room controls)
- **Structured Logging**: Pino with level tracers
- **Validation**: Zod (DTO, query, body parameter schema guards)
- **Testing**: Vitest (Unit, Integration, and Concurrency Load tests)

---

## 🏗️ Architecture Design (Protocol Zero Workflow)

```mermaid
sequenceDiagram
    autonumber
    actor Incident Dispatcher
    participant Queue as RiskEvaluationQueue
    participant Service as RiskEvaluationService
    participant P0Service as ProtocolZeroService
    actor Commander
    participant DB as Postgres Database
    participant Memory as Shared Incident Memory
    participant Sockets as Socket.io Gateway

    Incident Dispatcher->>Queue: Dispatch IncidentCreated Event
    activate Queue
    Queue->>Service: Run Async evaluateIncidentRisk(id)
    deactivate Queue
    activate Service
    Service->>Service: Execute Severity, Priority & Weighted Risk Engines
    Service->>DB: Save RiskAssessment & Predictions (tx)
    Service->>Memory: Append Assessment payload (Append-Only)
    Service->>Sockets: Broadcast "risk:updated" event
    
    Note over Service: If Risk Score >= 85 (Protocol Zero Triggered)
    Service->>P0Service: Trigger initiateApprovalRequest()
    activate P0Service
    P0Service->>DB: Write ApprovalRequest & Log Histories (tx)
    P0Service->>Sockets: Broadcast "protocol_zero:approval_requested"
    deactivate Service
    
    Commander->>P0Service: Action Decision (Approve / Reject / Modify)
    P0Service->>DB: Record ApprovalDecision & override logs (tx)
    P0Service->>Memory: Append Approval Status & justified notes
    P0Service->>Sockets: Broadcast "protocol_zero:completed" and final updates
    deactivate P0Service
```

---

## 🚀 Getting Started

### 1. Environment Variables (`.env`)
Create a `.env` file in the `backend/` directory:
```env
DATABASE_URL="postgresql://postgres:password123@localhost:5432/argus?schema=public"
REDIS_URL="redis://localhost:6379"
GEMINI_API_KEY="AIzaSyYourKeyHere..."
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
```

### 2. Launch Local Database & Cache
```bash
docker-compose up -d postgres redis
```

### 3. Generate Prisma & Run Migrations
```bash
npx prisma generate
npx prisma db push
```

### 4. Running the Development Server
```bash
npm run dev
```
The server will boot on [http://localhost:3001](http://localhost:3001).

---

## 🧪 Running the Verification Test Suite
The backend is covered by Vitest suites testing calculations, controller policies, and queue concurrency limits.

```bash
# Run all tests
npm test
```

---

## 🐳 Docker Deployment

### Build & Run Standalone Image
```bash
# Build
docker build -t argus-backend:latest .

# Run
docker run -p 3001:3001 \
  -e DATABASE_URL="postgresql://postgres:password123@host.docker.internal:5432/argus" \
  -e REDIS_URL="redis://host.docker.internal:6379" \
  argus-backend:latest
```
Check health on: `GET http://localhost:3001/api/health`
