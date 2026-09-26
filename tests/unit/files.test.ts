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
import { INLINE_MIMES, MIME_EXTENSIONS, sanitizeFileName } from "@/server/services/storage.service";

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
