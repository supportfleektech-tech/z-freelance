import { randomUUID } from "node:crypto";
import path from "node:path";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { and, eq, inArray, isNull, lt, notExists, sql } from "drizzle-orm";
import { db as getDb, type DbOrTx } from "@/lib/db";
import {
  attachments,
  contracts,
  messages,
  milestones,
  portfolioItems,
  threads,
  type Attachment,
  type AttachmentContext,
} from "@/lib/db/schema";
import { config } from "@/lib/config";
import { ApiError } from "@/lib/api/http";

/**
 * File storage: bytes on local disk (UPLOAD_DIR), metadata + authorization
 * in Postgres.
 *
 * Design rules:
 *  - Storage keys are server-generated (`uuid.ext`) so user input never
 *    becomes a filesystem path — traversal is structurally impossible.
 *  - The MIME allowlist is the only source of truth for what can be stored;
 *    the stored extension comes from the MIME type, never from the client
 *    filename.
 *  - Uploads start unlinked and are bound to exactly one message or escrow
 *    milestone when the post they belong to is submitted. Authorization for
 *    download derives from that link (thread participant / contract party),
 *    plus the uploader and admins. Unlinked PORTFOLIO files (profile imagery)
 *    are public by design.
 */

/** The single source of truth: which MIME types we store, and their extension. */
export const MIME_EXTENSIONS = new Map<string, string>([
  ["image/png", ".png"],
  ["image/jpeg", ".jpg"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
  ["application/pdf", ".pdf"],
  ["text/plain", ".txt"],
  ["text/markdown", ".md"],
  ["text/csv", ".csv"],
  ["application/zip", ".zip"],
  ["application/msword", ".doc"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".xlsx"],
]);

/** Types rendered inline by browsers; everything else downloads. */
export const INLINE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

/**
 * Magic-byte signatures for the binary types we accept. `PK` archives cover
 * zip/docx/xlsx; the OLE magic covers legacy .doc. Types without a reliable
 * signature (plain text formats) are guarded against binary masquerading by
 * the NUL-byte rule below instead.
 */
const MAGIC_SIGNATURES: Record<string, number[][]> = {
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/gif": [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
  ],
  "application/pdf": [[0x25, 0x50, 0x44, 0x46, 0x2d]], // "%PDF-"
  "application/zip": [[0x50, 0x4b, 0x03, 0x04]],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    [0x50, 0x4b, 0x03, 0x04],
  ],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [[0x50, 0x4b, 0x03, 0x04]],
  "application/msword": [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]],
};

const TEXT_MIMES = new Set(["text/plain", "text/markdown", "text/csv"]);

/**
 * Does the file's actual content plausibly match the declared MIME? A client
 * can trivially lie about the type field; this check is what stops
 * `malware.exe` being stored and later served as `image/png` with an inline
 * disposition.
 */
export function bytesMatchMime(mimeType: string, bytes: Buffer | Uint8Array): boolean {
  const signatures = MAGIC_SIGNATURES[mimeType];
  if (signatures) {
    return signatures.some(
      (sig) => bytes.byteLength >= sig.length && sig.every((byte, index) => bytes[index] === byte),
    );
  }
  if (TEXT_MIMES.has(mimeType)) {
    const head = bytes.subarray(0, Math.min(bytes.byteLength, 4096));
    // Real text never contains a NUL byte in its head…
    if (head.includes(0x00)) return false;
    // …and real text never opens with a known binary container signature.
    for (const signatures of Object.values(MAGIC_SIGNATURES)) {
      if (
        signatures.some(
          (sig) =>
            bytes.byteLength >= sig.length && sig.every((byte, index) => bytes[index] === byte),
        )
      ) {
        return false;
      }
    }
    return true;
  }
  // webp: RIFF container (magic above) + "WEBP" fourcc at offset 8
  if (mimeType === "image/webp") {
    return (
      bytes.byteLength >= 12 &&
      bytes[0] === 0x52 && // R
      bytes[1] === 0x49 && // I
      bytes[2] === 0x46 && // F
      bytes[3] === 0x46 && // F
      bytes[8] === 0x57 && // W
      bytes[9] === 0x45 && // E
      bytes[10] === 0x42 && // B
      bytes[11] === 0x50 // P
    );
  }
  return true;
}

export function isImageMime(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

export function uploadDirPath(): string {
  return path.resolve(config.uploadDir);
}

function storagePath(storageKey: string): string {
  // Storage keys originate from `randomUUID()` below; this guard exists so a
  // hypothetical future caller can never turn user input into a path.
  if (!/^[0-9a-f-]+\.[a-z0-9]+$/i.test(storageKey)) {
    throw ApiError.badRequest("Invalid storage key.");
  }
  return path.join(uploadDirPath(), storageKey);
}

export function sanitizeFileName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[\\/]/g, "-") // no path separators
    .replace(/\.{2,}/g, ".") // no traversal sequences
    .replace(/^[.\-_]+/, ""); // no hidden-file names like ".env"
  if (!cleaned) return "file";
  return cleaned.slice(0, config.limits.uploadFileName);
}

export interface StoreUploadInput {
  uploaderId: string;
  context: AttachmentContext;
  fileName: string;
  mimeType: string;
  data: Buffer | Uint8Array;
  /** When set, the row is bound immediately (milestone submit, message send). */
  messageId?: string | null;
  milestoneId?: string | null;
}

/** Validate + persist one file. Returns the attachment metadata row. */
export async function storeUpload(input: StoreUploadInput): Promise<Attachment> {
  const mime = input.mimeType.toLowerCase().trim();
  const extension = MIME_EXTENSIONS.get(mime);
  if (!extension) {
    throw ApiError.unprocessable(
      `Files of type ${input.mimeType || "unknown"} are not accepted. ` +
        "Allowed: images, PDF, plain text, CSV, zip and office documents.",
    );
  }
  if (input.data.byteLength === 0) {
    throw ApiError.unprocessable("Empty files cannot be uploaded.");
  }
  if (input.data.byteLength > config.uploadMaxBytes) {
    throw ApiError.unprocessable(
      `Files are limited to ${Math.floor(config.uploadMaxBytes / (1024 * 1024))} MB.`,
    );
  }
  if (!bytesMatchMime(mime, input.data)) {
    throw ApiError.unprocessable("The file's contents do not match its declared type.");
  }

  const storageKey = `${randomUUID()}${extension}`;
  const dir = uploadDirPath();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, storageKey), input.data);

  const database = await getDb();
  try {
    const [row] = await database
      .insert(attachments)
      .values({
        uploaderId: input.uploaderId,
        context: input.context,
        messageId: input.messageId ?? null,
        milestoneId: input.milestoneId ?? null,
        fileName: sanitizeFileName(input.fileName),
        storageKey,
        mimeType: mime,
        sizeBytes: input.data.byteLength,
      })
      .returning();
    if (!row) throw new Error("attachment insert returned no row");
    return row;
  } catch (error) {
    // The database said no (FK/size/etc.) — don't leave an orphan on disk.
    await unlink(path.join(dir, storageKey)).catch(() => undefined);
    throw error;
  }
}

interface LinkOptions {
  uploaderId: string;
  attachmentIds: string[];
  context: AttachmentContext;
  messageId?: string;
  milestoneId?: string;
}

/**
 * Bind previously-uploaded files to their post. Runs inside the caller's
 * transaction, so a rejected link rolls the whole submission back — a file
 * can never appear attached to content that failed to save.
 */
export async function linkAttachments(tx: DbOrTx, options: LinkOptions): Promise<void> {
  if (options.attachmentIds.length === 0) return;

  const rows = await tx
    .select()
    .from(attachments)
    .where(inArray(attachments.id, options.attachmentIds));

  if (rows.length !== options.attachmentIds.length) {
    throw ApiError.badRequest("Some of the referenced files do not exist.");
  }
  for (const row of rows) {
    if (row.uploaderId !== options.uploaderId) {
      throw ApiError.forbidden("You can only attach files you uploaded.");
    }
    if (row.context !== options.context) {
      throw ApiError.unprocessable(
        `"${row.fileName}" was uploaded for a different purpose and cannot be attached here.`,
      );
    }
    if (row.messageId || row.milestoneId) {
      throw ApiError.conflict(`"${row.fileName}" is already attached to another post.`);
    }
  }

  const patch =
    options.context === "MESSAGE"
      ? { messageId: options.messageId ?? null }
      : { milestoneId: options.milestoneId ?? null };

  await tx.update(attachments).set(patch).where(inArray(attachments.id, options.attachmentIds));
}

/** Attachment metadata grouped by message / milestone, for page rendering. */
export async function listMessageAttachments(
  db: DbOrTx,
  messageIds: string[],
): Promise<Map<string, Attachment[]>> {
  if (messageIds.length === 0) return new Map();
  const rows = await db
    .select()
    .from(attachments)
    .where(inArray(attachments.messageId, messageIds));
  return groupBy(rows, (a) => a.messageId);
}

export async function listMilestoneAttachments(
  db: DbOrTx,
  milestoneIds: string[],
): Promise<Map<string, Attachment[]>> {
  if (milestoneIds.length === 0) return new Map();
  const rows = await db
    .select()
    .from(attachments)
    .where(inArray(attachments.milestoneId, milestoneIds));
  return groupBy(rows, (a) => a.milestoneId);
}

function groupBy(rows: Attachment[], key: (a: Attachment) => string | null) {
  const map = new Map<string, Attachment[]>();
  for (const row of rows) {
    const k = key(row);
    if (!k) continue;
    const list = map.get(k) ?? [];
    list.push(row);
    map.set(k, list);
  }
  return map;
}

/** Decide who may read an attachment's bytes. Pure SQL, no I/O. */
export async function assertCanView(
  db: DbOrTx,
  viewer: { id: string; role: string } | null,
  attachmentId: string,
): Promise<Attachment> {
  const [row] = await db
    .select()
    .from(attachments)
    .where(eq(attachments.id, attachmentId))
    .limit(1);
  if (!row) throw ApiError.notFound("File not found.");

  // Portfolio imagery is public by design — it renders on public profiles.
  if (row.context === "PORTFOLIO") return row;

  if (!viewer) throw ApiError.unauthorized("Sign in to access this file.");
  if (viewer.role === "ADMIN" || row.uploaderId === viewer.id) return row;

  if (row.messageId) {
    const [thread] = await db
      .select({ a: threads.participantAId, b: threads.participantBId })
      .from(messages)
      .innerJoin(threads, eq(threads.id, messages.threadId))
      .where(eq(messages.id, row.messageId))
      .limit(1);
    // A missing thread means the message vanished (cascade) — deny by default.
    if (thread && (thread.a === viewer.id || thread.b === viewer.id)) return row;
    throw ApiError.forbidden("You are not a participant in that conversation.");
  }

  if (row.milestoneId) {
    const [row2] = await db
      .select({ clientId: contracts.clientId, freelancerId: contracts.freelancerId })
      .from(milestones)
      .innerJoin(contracts, eq(contracts.id, milestones.contractId))
      .where(eq(milestones.id, row.milestoneId))
      .limit(1);
    if (row2 && (row2.clientId === viewer.id || row2.freelancerId === viewer.id)) return row;
    throw ApiError.forbidden("You are not a party to that contract.");
  }

  // Unlinked MESSAGE/MILESTONE uploads: only the uploader (covered above).
  throw ApiError.forbidden();
}

/** Fetch the file once access has been established. */
export async function readAuthorizedFile(
  viewer: { id: string; role: string } | null,
  attachmentId: string,
): Promise<{ attachment: Attachment; filePath: string }> {
  const database = await getDb();
  const attachment = await assertCanView(database, viewer, attachmentId);
  return { attachment, filePath: storagePath(attachment.storageKey) };
}

/**
 * Delete an attachment row and its bytes. Allowed for the uploader, and only
 * for files that are either unlinked or owned through the given context —
 * linked message/milestone files are immutable history (they cascade away
 * with their parent rows instead).
 */
export async function deleteUpload(uploaderId: string, attachmentId: string): Promise<void> {
  const database = await getDb();
  const [row] = await database
    .select()
    .from(attachments)
    .where(and(eq(attachments.id, attachmentId), eq(attachments.uploaderId, uploaderId)))
    .limit(1);
  if (!row) throw ApiError.notFound("File not found.");
  if (row.messageId || row.milestoneId) {
    throw ApiError.conflict("Files attached to a sent post cannot be removed.");
  }

  await database.delete(attachments).where(eq(attachments.id, row.id));
  await unlink(storagePath(row.storageKey)).catch(() => undefined);
}

/**
 * Internal helper for services that replace/remove a portfolio cover image:
 * delete the image attachment row + bytes when it belongs to this user.
 * `set null` on the FK keeps this safe even without a transaction.
 */
export async function deleteOwnedAttachmentQuietly(
  dbOrTx: DbOrTx,
  uploaderId: string,
  attachmentId: string | null | undefined,
): Promise<void> {
  if (!attachmentId) return;
  const [row] = await dbOrTx
    .select()
    .from(attachments)
    .where(and(eq(attachments.id, attachmentId), eq(attachments.uploaderId, uploaderId)))
    .limit(1);
  if (!row) return;
  await dbOrTx.delete(attachments).where(eq(attachments.id, row.id));
  await unlink(storagePath(row.storageKey)).catch(() => undefined);
}

/**
 * Garbage-collect abandoned uploads: files that were uploaded but never
 * linked to a post (composer closed, form abandoned) and not referenced by a
 * saved portfolio item. Rows AND bytes are removed. Returns the count swept.
 *
 * Safe by construction: anything reachable from a message, a milestone or a
 * portfolio item is untouchable, whatever its age.
 */
export async function gcOrphanedUploads(olderThan: Date): Promise<number> {
  const database = await getDb();
  const orphans = await database
    .select({ id: attachments.id, storageKey: attachments.storageKey })
    .from(attachments)
    .where(
      and(
        isNull(attachments.messageId),
        isNull(attachments.milestoneId),
        lt(attachments.createdAt, olderThan),
        // A PORTFOLIO upload referenced by a saved item is in use, not an orphan.
        notExists(
          database
            .select({ one: sql`1` })
            .from(portfolioItems)
            .where(eq(portfolioItems.imageAttachmentId, attachments.id)),
        ),
      ),
    );

  if (orphans.length === 0) return 0;

  await database.delete(attachments).where(
    inArray(
      attachments.id,
      orphans.map((o) => o.id),
    ),
  );

  const dir = uploadDirPath();
  let swept = 0;
  for (const orphan of orphans) {
    try {
      await unlink(path.join(dir, orphan.storageKey));
      swept += 1;
    } catch {
      // Bytes already gone (manual cleanup, disk issue) — the row is what mattered.
    }
  }
  return swept;
}
