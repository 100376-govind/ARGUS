import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid PostgreSQL connection string"),
  REDIS_URL: z.string().url("REDIS_URL must be a valid connection string"),
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
  CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY is required"),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required"),
  FIREBASE_PROJECT_ID: z.string().min(1, "FIREBASE_PROJECT_ID is required"),
  FIREBASE_CLIENT_EMAIL: z.string().email("FIREBASE_CLIENT_EMAIL must be a valid service account email"),
  FIREBASE_PRIVATE_KEY: z.string().min(1, "FIREBASE_PRIVATE_KEY is required"),
  FIREBASE_STORAGE_BUCKET: z.string().min(1, "FIREBASE_STORAGE_BUCKET is required"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().transform((v) => parseInt(v, 10)).default("3001"),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build" || process.env.NODE_ENV === "test";

  // Format private key properly if it contains escaped newlines
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    : (isBuildPhase ? "-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----\n" : undefined);

  const parsed = envSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL || (isBuildPhase ? "postgresql://mock:mock@localhost:5432/mock?schema=public" : undefined),
    REDIS_URL: process.env.REDIS_URL || (isBuildPhase ? "redis://localhost:6379" : undefined),
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || (isBuildPhase ? "mock-gemini-key" : undefined),
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || (isBuildPhase ? "sk_mock" : undefined),
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || (isBuildPhase ? "pk_mock" : undefined),
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || (isBuildPhase ? "mock-project" : undefined),
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || (isBuildPhase ? "mock@mock.iam.gserviceaccount.com" : undefined),
    FIREBASE_PRIVATE_KEY: privateKey,
    FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET || (isBuildPhase ? "mock-bucket" : undefined),
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
  });

  if (!parsed.success) {
    console.error("❌ Invalid environment configuration:", parsed.error.format());
    throw new Error("Invalid environment configuration");
  }

  return parsed.data;
}

export const env = validateEnv();
