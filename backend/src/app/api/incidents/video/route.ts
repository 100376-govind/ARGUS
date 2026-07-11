import { NextRequest, NextResponse } from "next/server";
import { withHandler } from "@/presentation/middleware/with-handler";
import { dataDispatcherService } from "@/shared/container";
import { AppError } from "@/shared/errors/app-error";

const ALLOWED_VIDEO_TYPES = [
  "video/mp4", "video/webm", "video/quicktime", "video/x-msvideo",
  "video/x-matroska", "video/mpeg",
];

const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB

export const POST = withHandler(async (req: NextRequest) => {
  const formData = await req.formData();
  const videoFile = formData.get("video") as File | null;

  if (!videoFile) {
    throw AppError.validation("Missing required 'video' file in form data");
  }

  if (!ALLOWED_VIDEO_TYPES.includes(videoFile.type)) {
    throw AppError.validation(`Unsupported video type: ${videoFile.type}. Allowed: ${ALLOWED_VIDEO_TYPES.join(", ")}`);
  }

  if (videoFile.size > MAX_VIDEO_SIZE) {
    throw AppError.validation(`Video file too large: ${videoFile.size} bytes. Max: ${MAX_VIDEO_SIZE} bytes`);
  }

  const videoBuffer = Buffer.from(await videoFile.arrayBuffer());

  const reporterName = formData.get("reporterName") as string | null;
  const reporterEmail = formData.get("reporterEmail") as string | null;
  const reporterPhone = formData.get("reporterPhone") as string | null;
  const reporterRole = formData.get("reporterRole") as string | null;
  const metadataRaw = formData.get("metadata") as string | null;
  const description = formData.get("description") as string | null;

  const reporterData = reporterName
    ? { name: reporterName, email: reporterEmail, phone: reporterPhone, role: reporterRole || "civilian" }
    : undefined;

  const metadata = metadataRaw ? JSON.parse(metadataRaw) : undefined;
  if (description && metadata) {
    metadata.description = description;
  }

  const incident = await dataDispatcherService.dispatchVideo(
    videoBuffer,
    videoFile.type,
    reporterData,
    description ? { ...metadata, description } : metadata
  );

  return NextResponse.json({ success: true, data: incident }, { status: 201 });
});
