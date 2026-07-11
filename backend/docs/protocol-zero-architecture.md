# ARGUS Protocol Zero & Security Documentation

This guide describes the technical architecture, security measures, and API specifications for the **Protocol Zero** review workflow in the ARGUS Multi-Agent Crisis Command Platform.

---

## 🛡️ Security Hardening & RBAC

The presentation layer applies DevSecOps hardening principles:
1. **HTTP Security Headers**: Uses `SecurityMiddleware` to inject essential defensive headers on every response:
   - `X-Frame-Options: DENY` (neutralizes Clickjacking)
   - `X-Content-Type-Options: nosniff` (mitigates MIME-sniffing)
   - `Content-Security-Policy` (CSP) restrictions
   - `Strict-Transport-Security` (HSTS) enforcing HTTPS channels.
2. **CORS Controls**: Strict checks restricting cross-origin payloads to allowed, verified boundaries.
3. **High-Performance Redis Rate Limiting**: Monitors client IPs and throttles brute-force attempts using Redis counter keys.
4. **HTML/XSS Input Sanitization**: Recursively escapes input variables (`<`, `>`, `&`, `"`, `'`) before parsing Zod validation schemas.
5. **SQL Injection Defense**: Uses Prisma parameterization (`prisma.$queryRaw` or ORM methods) to validate values and isolate queries from query-string injection vectors.
6. **Role-Based Access Control (RBAC)**: Validates authenticated Clerk tokens and checks user privileges:
   - `Viewer`: General status checks.
   - `Dispatcher`: Triggers evaluations and escalations.
   - `Commander`: Grants overrides, modifications, and final authorizations.
   - `Admin`: Full permissions across databases, configurations, and queues.

---

## 📈 Observability & Site Reliability Engineering (SRE)

The service logs metrics and registers latency tracers under `/api/risk/metrics` (accessible by Admin/Commander/Dispatcher):
- **API Latency**: Captures handler cycle times per path/method.
- **Gemini AI Call Latency**: Monitored performance traces per prompt call.
- **Redis Connection Latency**: Measures publisher and subscriber connectivity roundtrips.
- **Database Query Times**: Profiles transaction commit times.
- **Active Task Queue Stats**: Real-time worker counts, queue lengths, and backpressure rejects.

---

## 🔌 API Endpoint Specifications

### 1. POST `/api/risk/evaluate`
* **Access**: Dispatcher, Commander, Admin
* **Description**: Evaluates raw threat indicators for an incident in the background queue.
* **Request Body**:
```json
{
  "incidentId": "INC-1234"
}
```
* **Response (201 Created)**:
```json
{
  "success": true,
  "message": "Incident evaluated successfully",
  "timestamp": "2026-07-11T13:12:00.000Z",
  "requestId": "req-98fshb78s",
  "data": {
    "id": "ra-uuid-9828",
    "incidentId": "INC-1234",
    "severity": "CRITICAL",
    "priority": "HIGH",
    "overallRiskScore": 86,
    "confidence": 0.95,
    "isProtocolZeroTriggered": true
  }
}
```

### 2. POST `/api/protocol-zero/request`
* **Access**: Dispatcher, Commander, Admin
* **Description**: Triggers a Commander Approval request manually.
* **Request Body**:
```json
{
  "protocolZeroRequestId": "p0-request-uuid",
  "commanderId": "commander-user-uuid"
}
```

### 3. POST `/api/protocol-zero/approve`
* **Access**: Commander, Admin
* **Description**: Authorizes a Protocol Zero action request.
* **Request Body**:
```json
{
  "approvalRequestId": "approval-request-uuid",
  "justification": "Threat levels verified. Commencing tactical deployment."
}
```

### 4. POST `/api/protocol-zero/reject`
* **Access**: Commander, Admin
* **Description**: Rejects/cancels a Protocol Zero action request.
* **Request Body**:
```json
{
  "approvalRequestId": "approval-request-uuid",
  "justification": "Safety thresholds safe. Tactical team stand-down."
}
```

### 5. PATCH `/api/protocol-zero/modify`
* **Access**: Commander, Admin
* **Description**: Overrides severity/priority metrics and authorizes the override action.
* **Request Body**:
```json
{
  "approvalRequestId": "approval-request-uuid",
  "justification": "Downgrading priority score following hospital clear signals.",
  "modifications": {
    "severity": "HIGH",
    "priority": "MEDIUM"
  }
}
```

### 6. GET `/api/protocol-zero/history/:incidentId`
* **Access**: Dispatcher, Commander, Admin
* **Description**: Returns all history actions, modification payloads, decision justifications, and escalations.
