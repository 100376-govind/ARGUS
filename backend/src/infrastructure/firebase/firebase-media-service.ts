import { IMediaService } from "@/domain/services/media-service";
import { storage } from "./firebase-admin";
import { logger } from "@/infrastructure/logger/pino";
import { BadGatewayError } from "@/shared/errors/app-error";

export class FirebaseMediaService implements IMediaService {
  async uploadFile(fileBuffer: Buffer, fileName: string, mimeType: string): Promise<string> {
    try {
      const bucket = storage.bucket();
      const file = bucket.file(fileName);

      // Save file buffer directly to Firebase Storage
      await file.save(fileBuffer, {
        metadata: { contentType: mimeType },
        resumable: false,
      });

      logger.debug({ fileName, mimeType }, "File uploaded successfully to Firebase Storage");

      // Generate signed URL valid for 7 days
      return this.getSignedUrl(fileName);
    } catch (error) {
      logger.error({ error, fileName }, "Failed to upload file to Firebase Storage");
      throw new BadGatewayError("Firebase upload failed", error);
    }
  }

  async getSignedUrl(filePath: string): Promise<string> {
    try {
      const bucket = storage.bucket();
      const file = bucket.file(filePath);

      const [url] = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days expiration
      });

      return url;
    } catch (error) {
      logger.error({ error, filePath }, "Failed to generate signed URL for storage object");
      throw new BadGatewayError("Firebase signed URL generation failed", error);
    }
  }
}

export const mediaService = new FirebaseMediaService();
