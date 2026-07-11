# ARGUS Compliance Auditor

The Compliance Auditor is a production-hardened auditing service verifying multi-agent operational telemetry in the ARGUS platform.

---

## 1. Architecture Summary

```
                      +-----------------------------+
                      |     Incident Repository     |
                      +--------------+--------------+
                                     |
                                     v
                       +-------------+-------------+
                       |  Shared Memory Integration|
                       +-------------+-------------+
                                     |
              +----------------------+----------------------+
              |                                             |
              v                                             v
  +-----------+-----------+                     +-----------+-----------+
  | Event Tracking Service|                     | Report Gen Service    |
  +-----------+-----------+                     +-----------+-----------+
              |                                             |
              v                                             v
  +-----------+-----------+                     +-----------+-----------+
  | Timeline Sync Service |                     | Gemini Report Service |
  +-----------+-----------+                     +-----------+-----------+
              |                                             |
              v                                             v
  +-----------+-----------+                     +-----------+-----------+
  | AuditStatusCalculator |                     |  PDF Export Service   |
  +-----------------------+                     +-----------------------+
```

---

## 2. API Documentation

### Compliance Core Endpoints

#### `GET /api/compliance/:incidentId`
- Returns full audit log, sorted timeline events, and current compliance status.

#### `GET /api/compliance/timeline/:incidentId`
- Returns chronological timeline of logged incidents.

#### `GET /api/compliance/report/:incidentId`
- Returns situation reports (SITREP), incident summaries, decision details, and recommendations.

#### `GET /api/compliance/pdf/:incidentId`
- Returns downloadable PDF binary representation of the audit logs.

#### `GET /api/compliance/health`
- Returns health state of Database, Redis, Gemini, Sockets, and Auditor.

#### `GET /api/compliance/metrics`
- Returns latencies, success rates, and request totals.

---

## 3. Environment Variables

Create or modify `.env.backend`:

```env
DATABASE_URL="postgresql://username:password@host:port/database"
REDIS_URL="redis://localhost:6379"
GEMINI_API_KEY="AIzaSy..."
PORT=3001
```

---

## 4. Testing & Load Testing

Run the entire test suite:
```bash
npx vitest run src/compliance-auditor/tests/
```

To run the load testing simulator:
```typescript
import { LoadTester } from "./tests/load-test";
await LoadTester.runSuite();
```
