import { NextRequest, NextResponse } from "next/server";
import { withHandler } from "@/presentation/middleware/with-handler";
import { dataDispatcherService } from "@/shared/container";
import { AppError } from "@/shared/errors/app-error";


const ALLOWED_AUDIO_TYPES = [
  "audio/wav", "audio/mpeg", "audio/mp3", "audio/ogg",
  "audio/webm", "audio/flac", "audio/aac", "audio/x-wav",
];

const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25 MB

export const POST = withHandler(async (req: NextRequest) => {
  const formData = await req.formData();
  const audioFile = formData.get("audio") as File | null;

  if (!audioFile) {
    throw AppError.validation("Missing required 'audio' file in form data");
  }

  if (!ALLOWED_AUDIO_TYPES.includes(audioFile.type)) {
    throw AppError.validation(`Unsupported audio type: ${audioFile.type}. Allowed: ${ALLOWED_AUDIO_TYPES.join(", ")}`);
  }

  if (audioFile.size > MAX_AUDIO_SIZE) {
    throw AppError.validation(`Audio file too large: ${audioFile.size} bytes. Max: ${MAX_AUDIO_SIZE} bytes`);
  }

  const audioBuffer = Buffer.from(await audioFile.arrayBuffer());

  // Parse optional metadata from form fields
  const reporterName = formData.get("reporterName") as string | null;
  const reporterEmail = formData.get("reporterEmail") as string | null;
  const reporterPhone = formData.get("reporterPhone") as string | null;
  const reporterRole = formData.get("reporterRole") as string | null;
  const metadataRaw = formData.get("metadata") as string | null;

  const reporterData = reporterName
    ? {
        name: reporterName,
        email: reporterEmail,
        phone: reporterPhone,
        role: reporterRole || "civilian",
      }
    : undefined;

  const metadata = metadataRaw ? JSON.parse(metadataRaw) : undefined;

  const incident = await dataDispatcherService.dispatchAudio(
    audioBuffer,
    audioFile.type,
    reporterData,
    metadata
  );

  return NextResponse.json({ success: true, data: incident }, { status: 201 });
});
