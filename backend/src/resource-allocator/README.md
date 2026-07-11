# ARGUS Resource Allocator

Production-hardened, real-time routing, smart matching, and dispatch scheduling system for the ARGUS Crisis Command Platform.

## 🛠️ Key Optimizations (Phase 4.55)

- **Performance & Lazy-loading**: Deduplicates active parallel requests, utilizes lazy initialization, and speeds up location lookups.
- **Robust Caching**: Integrates Redis for caching Allocation plans, Route ETAs, and Nearest Responders, featuring built-in TTLs, manual invalidations, and seamless connection timeouts fallback.
- **Deep Monitoring**: Tracks real-time API latency, queue delays, Maps response time, and Redis connection checks.
- **Advanced Diagnostics**: Exposes dedicated REST API health endpoint (`GET /api/resource-allocator/health`) checking database connections, Redis readiness, and socket.io presence.

## 🚀 Environment Configuration

Ensure the following variables are defined inside your `.env`:

```env
DATABASE_URL="postgresql://postgres:password123@localhost:5432/argus?schema=public"
REDIS_URL="redis://localhost:6379"
GEMINI_API_KEY="AIzaSyYourKeyHere..."
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="AIzaSyYourMapsKey..."
NEXT_PUBLIC_GOOGLE_MAP_ID="your_map_id"
```

## 🧪 Testing Verification

```bash
# Run tests
npm test
```
