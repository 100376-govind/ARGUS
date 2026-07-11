import { PrismaIncidentRepository } from "@/infrastructure/database/prisma-incident-repository";
import { GeminiClient } from "@/infrastructure/gemini/gemini-client";
import { FirebaseMediaService } from "@/infrastructure/firebase/firebase-media-service";
import { RedisEventBus } from "@/infrastructure/redis/redis-event-bus";
import { DataDispatcherService } from "@/application/agents/data-dispatcher/data-dispatcher-service";
import { validationRedisSubscriber } from "@/evidence-fusion/services/redis-subscriber.service";

/**
 * Poor-man's Dependency Injection Container.
 * Instantiates all infrastructure adapters and wires them into application services.
 * In a larger codebase this would be replaced by InversifyJS or tsyringe.
 */

const incidentRepo = new PrismaIncidentRepository();
const aiClient = new GeminiClient();
const mediaService = new FirebaseMediaService();
const eventBus = new RedisEventBus();

// Initialize the Field Validator background Redis event subscribers
validationRedisSubscriber.initialize().catch((err) => {
  console.error("Failed to initialize validation Redis subscriber:", err);
});

export const dataDispatcherService = new DataDispatcherService(
  incidentRepo,
  aiClient,
  mediaService,
  eventBus
);

export { incidentRepo, aiClient, mediaService, eventBus };

