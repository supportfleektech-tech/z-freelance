import type { NextRequest } from "next/server";
import { ApiError, created, route, throttle } from "@/lib/api/http";
import { uploadQuerySchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth/guards";
import { storeUpload } from "@/server/services/storage.service";

export const dynamic = "force-dynamic";

/**
 * POST /api/uploads?context=MESSAGE|MILESTONE|PORTFOLIO
 *
 * Multipart upload of a single file (field name: `file`). The row starts
 * unlinked; a later message send / milestone submit / portfolio save binds
 * it, inside that post's own transaction.
 */
export const POST = route(async (request: NextRequest) => {
  throttle(request, "api", "uploads:create");

  const user = await requireUser();

  const url = new URL(request.url);
  const parsedQuery = uploadQuerySchema.safeParse({ context: url.searchParams.get("context") });
  if (!parsedQuery.success) throw ApiError.badRequest("Unknown upload context.");
  const { context } = parsedQuery.data;

  if (context === "PORTFOLIO" && user.role !== "FREELANCER" && user.role !== "ADMIN") {
    throw ApiError.forbidden("Only freelancers upload portfolio imagery.");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw ApiError.badRequest("Expected a multipart/form-data request.");
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    throw ApiError.badRequest('Send the file in the "file" field of a multipart form.');
  }

  const attachment = await storeUpload({
    uploaderId: user.id,
    context,
    fileName: file.name || "file",
    mimeType: file.type || "application/octet-stream",
    data: Buffer.from(await file.arrayBuffer()),
  });

  return created({
    attachment: {
      id: attachment.id,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
    },
  });
});
