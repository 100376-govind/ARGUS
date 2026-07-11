import { NextRequest, NextResponse } from "next/server";
import { withHandler } from "@/presentation/middleware/with-handler";
import { dataDispatcherService } from "@/shared/container";
import { AppError } from "@/shared/errors/app-error";

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp",
];

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB

export const POST = withHandler(async (req: NextRequest) => {
  const formData = await req.formData();
  const imageFile = formData.get("image") as File | null;

  if (!imageFile) {
    throw AppError.validation("Missing required 'image' file in form data");
  }

  if (!ALLOWED_IMAGE_TYPES.includes(imageFile.type)) {
    throw AppError.validation(`Unsupported image type: ${imageFile.type}. Allowed: ${ALLOWED_IMAGE_TYPES.join(", ")}`);
  }

  if (imageFile.size > MAX_IMAGE_SIZE) {
    throw AppError.validation(`Image file too large: ${imageFile.size} bytes. Max: ${MAX_IMAGE_SIZE} bytes`);
  }

  const imageBuffer = Buffer.from(await imageFile.arrayBuffer());

  const reporterName = formData.get("reporterName") as string | null;
  const reporterEmail = formData.get("reporterEmail") as string | null;
  const reporterPhone = formData.get("reporterPhone") as string | null;
  const reporterRole = formData.get("reporterRole") as string | null;
  const metadataRaw = formData.get("metadata") as string | null;

  const reporterData = reporterName
    ? { name: reporterName, email: reporterEmail, phone: reporterPhone, role: reporterRole || "civilian" }
    : undefined;

  const metadata = metadataRaw ? JSON.parse(metadataRaw) : undefined;

  const incident = await dataDispatcherService.dispatchImage(
    imageBuffer,
    imageFile.type,
    reporterData,
    metadata
  );

  return NextResponse.json({ success: true, data: incident }, { status: 201 });
});
