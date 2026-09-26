/**
 * Unit tests for the feature-pack validation schemas and the pure storage
 * policy helpers (no database, no filesystem side effects).
 */
import { describe, expect, it } from "vitest";
import {
  attachmentIdsSchema,
  createPortfolioItemSchema,
  notificationPrefsSchema,
  reviewResponseSchema,
  updatePortfolioItemSchema,
  uploadQuerySchema,
} from "@/lib/validation/files";
import { sendMessageSchema } from "@/lib/validation/social";
import { safeInternalPath } from "@/lib/utils";
import { isSessionFresh } from "@/lib/auth/session";
import {
  bytesMatchMime,
  INLINE_MIMES,
  MIME_EXTENSIONS,
  sanitizeFileName,
} from "@/server/services/storage.service";

const uuid = "00000000-0000-4000-8000-000000000001";

describe("upload query + attachment ids", () => {
  it("accepts known contexts and defaults to MESSAGE", () => {
    expect(uploadQuerySchema.parse({ context: "PORTFOLIO" }).context).toBe("PORTFOLIO");
    expect(uploadQuerySchema.parse({}).context).toBe("MESSAGE");
    expect(uploadQuerySchema.safeParse({ context: "EVIL" }).success).toBe(false);
  });

  it("caps attachments per post at 5 and rejects junk ids", () => {
    expect(attachmentIdsSchema.parse(undefined)).toEqual([]);
    expect(attachmentIdsSchema.parse([uuid, uuid])).toHaveLength(2);
    expect(attachmentIdsSchema.safeParse(Array(6).fill(uuid)).success).toBe(false);
    expect(attachmentIdsSchema.safeParse(["not-a-uuid"]).success).toBe(false);
  });

  it("sendMessage carries attachment ids through unchanged", () => {
    const parsed = sendMessageSchema.parse({
      threadId: uuid,
      body: "see attached",
      attachmentIds: [uuid],
    });
    expect(parsed.attachmentIds).toEqual([uuid]);
  });
});

describe("portfolio schemas", () => {
  it("trims titles, normalizes URLs, allows a null image (explicit clear)", () => {
    const parsed = createPortfolioItemSchema.parse({
      title: "  My case study  ",
      url: "example.com/case-study",
      imageAttachmentId: null,
    });
    expect(parsed.title).toBe("My case study");
    expect(parsed.url).toBe("https://example.com/case-study");
    expect(parsed.imageAttachmentId).toBeNull();
  });

  it("rejects short titles, bad URLs and unknown keys", () => {
    expect(createPortfolioItemSchema.safeParse({ title: "ab" }).success).toBe(false);
    expect(
      createPortfolioItemSchema.safeParse({ title: "Valid title", url: "javascript:alert(1)" })
        .success,
    ).toBe(false);
    expect(createPortfolioItemSchema.safeParse({ title: "Valid title", hack: true }).success).toBe(
      false,
    );
  });

  it("the update schema is a strict partial", () => {
    expect(updatePortfolioItemSchema.parse({}).title).toBeUndefined();
    expect(updatePortfolioItemSchema.parse({ title: "Only this" }).description).toBeUndefined();
  });
});

describe("review response", () => {
  it("needs real content within limits", () => {
    expect(reviewResponseSchema.safeParse({ text: " " }).success).toBe(false);
    expect(reviewResponseSchema.safeParse({ text: "ok" }).success).toBe(true);
    expect(reviewResponseSchema.safeParse({ text: "x".repeat(1501) }).success).toBe(false);
  });
});

describe("notification prefs", () => {
  it("accepts known types and unknown keys are rejected", () => {
    expect(notificationPrefsSchema.parse({ MESSAGE_RECEIVED: false })).toEqual({
      MESSAGE_RECEIVED: false,
    });
    const parsed = notificationPrefsSchema.safeParse({ NOT_A_TYPE: false });
    expect(parsed.success).toBe(false);
  });
});

describe("storage policy helpers", () => {
  it("sanitizes file names (no path traversal, bounded length)", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("etc-passwd");
    expect(sanitizeFileName("  report final.pdf  ")).toBe("report final.pdf");
    expect(sanitizeFileName("")).toBe("file");
    expect(sanitizeFileName("a".repeat(500))).toHaveLength(240);
  });

  it("every allowlisted MIME has an extension; inline set is a subset", () => {
    for (const [mime, ext] of MIME_EXTENSIONS) {
      expect(ext.startsWith(".")).toBe(true);
      expect(mime).toMatch(/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/);
    }
    for (const mime of INLINE_MIMES) {
      expect(MIME_EXTENSIONS.has(mime)).toBe(true);
    }
    // Executables and HTML must never be servable content.
    expect(MIME_EXTENSIONS.has("application/x-msdownload")).toBe(false);
    expect(MIME_EXTENSIONS.has("text/html")).toBe(false);
    expect(MIME_EXTENSIONS.has("image/svg+xml")).toBe(false);
  });
});

describe("content sniffing (bytesMatchMime)", () => {
  it("accepts genuine signatures", () => {
    expect(
      bytesMatchMime(
        "image/png",
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
      ),
    ).toBe(true);
    expect(bytesMatchMime("image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]))).toBe(true);
    expect(bytesMatchMime("application/pdf", Buffer.from("%PDF-1.7\n"))).toBe(true);
    expect(bytesMatchMime("application/zip", Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x01]))).toBe(
      true,
    );
    expect(
      bytesMatchMime(
        "image/webp",
        Buffer.from([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]),
      ),
    ).toBe(true);
    expect(bytesMatchMime("text/plain", Buffer.from("hello world\n"))).toBe(true);
    expect(bytesMatchMime("text/csv", Buffer.from("a,b,c\n1,2,3\n"))).toBe(true);
  });

  it("rejects masquerading content", () => {
    // An EXE renamed to .png must not pass as an image.
    expect(bytesMatchMime("image/png", Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03]))).toBe(false);
    // A truncated signature is not a signature.
    expect(bytesMatchMime("application/zip", Buffer.from("PK"))).toBe(false);
    // RIFF ≠ WEBP (could be a WAV).
    expect(
      bytesMatchMime(
        "image/webp",
        Buffer.from([0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]),
      ),
    ).toBe(false);
    // Binary glued into a "text" upload.
    expect(bytesMatchMime("text/plain", Buffer.from([0x68, 0x69, 0x00, 0x01]))).toBe(false);
    expect(bytesMatchMime("text/markdown", Buffer.from([0x50, 0x4b, 0x03, 0x04]))).toBe(false);
  });
});

describe("safeInternalPath", () => {
  it("keeps genuine internal paths intact", () => {
    expect(safeInternalPath("/dashboard/saved")).toBe("/dashboard/saved");
    expect(safeInternalPath("/projects?skill=dbt#top")).toBe("/projects?skill=dbt#top");
    expect(safeInternalPath("/")).toBe("/");
  });

  it("neutralizes external and malformed targets", () => {
    expect(safeInternalPath("https://evil.example/phish", "/dashboard")).toBe("/dashboard");
    expect(safeInternalPath("//evil.example/path", "/dashboard")).toBe("/dashboard");
    expect(safeInternalPath("javascript:alert(1)", "/dashboard")).toBe("/dashboard");
    expect(safeInternalPath("dashboard/saved", "/dashboard")).toBe("/dashboard");
    expect(safeInternalPath("/\\evil", "/dashboard")).toBe("/dashboard");
    expect(safeInternalPath(null, "/dashboard")).toBe("/dashboard");
    expect(safeInternalPath(undefined, "/dashboard")).toBe("/dashboard");
    expect(safeInternalPath("", "/dashboard")).toBe("/dashboard");
  });
});

describe("isSessionFresh", () => {
  it("honours the invalidation watermark at whole-second granularity", () => {
    expect(isSessionFresh(null, 0)).toBe(true);
    const cut = new Date("2026-09-26T12:00:00Z");
    const cutSec = cut.getTime() / 1000;
    expect(isSessionFresh(cut, cutSec - 1)).toBe(false);
    expect(isSessionFresh(cut, cutSec)).toBe(true);
    expect(isSessionFresh(cut, cutSec + 60)).toBe(true);
  });

  it("grants a same-second grace window (JWT iat has second precision)", () => {
    // Watermark has millisecond precision; comparison floors it.
    const cut = new Date("2026-09-26T12:00:00.500Z");
    const secondBefore = Math.floor(cut.getTime() / 1000) - 1;
    const sameSecond = Math.floor(cut.getTime() / 1000);
    expect(isSessionFresh(cut, secondBefore)).toBe(false);
    expect(isSessionFresh(cut, sameSecond)).toBe(true);
  });
});
