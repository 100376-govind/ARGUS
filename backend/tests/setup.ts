/**
 * Global test setup for ARGUS Backend tests.
 * Sets mock environment variables so tests don't require real credentials.
 */

process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/argus_test?schema=public";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.GEMINI_API_KEY = "test-gemini-api-key";
process.env.CLERK_SECRET_KEY = "sk_test_mock";
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_mock";
process.env.FIREBASE_PROJECT_ID = "argus-test";
process.env.FIREBASE_CLIENT_EMAIL = "test@argus-test.iam.gserviceaccount.com";
process.env.FIREBASE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----\n";
process.env.FIREBASE_STORAGE_BUCKET = "argus-test.appspot.com";
(process.env as any).NODE_ENV = "test";
process.env.PORT = "3001";

