import * as admin from "firebase-admin";
import { env } from "@/shared/config/env";
import { logger } from "@/infrastructure/logger/pino";

const isAlreadyInitialized = admin.apps.length > 0;

export const firebaseAdmin = (() => {
  if (isAlreadyInitialized) {
    return admin.app();
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY,
      }),
      storageBucket: env.FIREBASE_STORAGE_BUCKET,
    });
    logger.info("Firebase Admin initialized successfully");
  } catch (error) {
    logger.error({ error }, "Failed to initialize Firebase Admin");
    const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
    if (!isBuildPhase) {
      throw error;
    }
  }

  try {
    return admin.app();
  } catch (e) {
    return null as any;
  }
})();

export const storage = (() => {
  try {
    return admin.storage();
  } catch (e) {
    const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
    if (isBuildPhase) {
      return null as any;
    }
    throw e;
  }
})();

