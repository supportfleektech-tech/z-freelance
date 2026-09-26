import { readFile } from "node:fs/promises";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ApiError, noContent, parseParams, route, throttle } from "@/lib/api/http";
import { idParamSchema } from "@/lib/validation";
import { getCurrentUser, requireUser } from "@/lib/auth/guards";
import { deleteUpload, INLINE_MIMES, readAuthorizedFile } from "@/server/services/storage.service";

export const dynamic = "force-dynamic";

/** RFC 5987 content-disposition with a sanitized ASCII fallback name. */
function contentDisposition(kind: "inline" | "attachment", fileName: string): string {
  const fallback = fileName
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_")
    .slice(0, 200);
  return `${kind}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/**
 * GET /api/files/:id — download/stream a stored file.
 * Access: uploader, admin, thread participants (MESSAGE), contract parties
 * (MILESTONE); PORTFOLIO imagery is public.
 */
export const GET = route(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    throttle(request, "api", "files:read");

    const { id } = await parseParams(context.params, idParamSchema);
    const viewer = await getCurrentUser();
    const { attachment, filePath } = await readAuthorizedFile(viewer, id);

    let bytes: Buffer;
    try {
      bytes = await readFile(filePath);
    } catch {
      // Row exists, bytes don't — the disk and database disagree (manual
      // deletion, disk failure). Surface as 404 rather than a bare 500.
      throw ApiError.notFound("The file is no longer available.");
    }

    const inline = INLINE_MIMES.has(attachment.mimeType);
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": contentDisposition(
          inline ? "inline" : "attachment",
          attachment.fileName,
        ),
        "Cache-Control":
          attachment.context === "PORTFOLIO" ? "public, max-age=3600" : "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  },
);

/** DELETE /api/files/:id — remove an upload that hasn't been linked to a post yet. */
export const DELETE = route(
  async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    throttle(request, "api", "files:delete");

    const { id } = await parseParams(context.params, idParamSchema);
    const user = await requireUser();
    await deleteUpload(user.id, id);
    return noContent();
  },
);
