import { z } from "zod";
import { config } from "../config";
import { notificationTypeEnum } from "../db/schema";
import { normalizeUrl } from "../utils";

/**
 * Validation for the "files & profile depth" feature pack: uploads,
 * portfolio items, review responses, saved projects, notification prefs.
 */

const urlField = (label: string) =>
  z
    .string()
    .trim()
    .max(300)
    .optional()
    .superRefine((value, ctx) => {
      if (value && normalizeUrl(value) === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} must be a valid http(s) URL.`,
        });
      }
    })
    .transform((value) => (value ? normalizeUrl(value) : undefined));

/** Where an uploaded file is destined — declared at upload time. */
export const uploadContextSchema = z.enum(["MESSAGE", "MILESTONE", "PORTFOLIO"]);
export type UploadContext = z.infer<typeof uploadContextSchema>;

/** Attachment ids a client may reference when posting a message / submission. */
export const attachmentIdsSchema = z
  .array(z.string().uuid())
  .max(
    config.limits.attachmentsPerPost,
    `At most ${config.limits.attachmentsPerPost} files per post.`,
  )
  .default([]);

export const uploadQuerySchema = z
  .object({
    context: uploadContextSchema.default("MESSAGE"),
  })
  .strict();

/* -------------------------------------------------------------- portfolio */

export const createPortfolioItemSchema = z
  .object({
    title: z.string().trim().min(3).max(config.limits.portfolioTitle),
    description: z.string().trim().max(config.limits.portfolioDescription).optional(),
    url: urlField("Project URL"),
    /** undefined = none/unchanged; null = explicitly clear the cover. */
    imageAttachmentId: z.string().uuid().nullish(),
  })
  .strict();

export type CreatePortfolioItemInput = z.infer<typeof createPortfolioItemSchema>;

export const updatePortfolioItemSchema = createPortfolioItemSchema.partial().strict();
export type UpdatePortfolioItemInput = z.infer<typeof updatePortfolioItemSchema>;

/* ---------------------------------------------------------------- reviews */

export const reviewResponseSchema = z
  .object({
    text: z
      .string()
      .trim()
      .min(2, "A response needs at least a couple of characters.")
      .max(config.limits.reviewResponse),
  })
  .strict();

export type ReviewResponseInput = z.infer<typeof reviewResponseSchema>;

/* --------------------------------------------------------- notifications */

/**
 * Per-type in-app notification switches. Records an explicit choice per type;
 * anything absent keeps the platform default (enabled). An explicit shape is
 * used (instead of z.record) so unknown keys are rejected outright.
 */
export const notificationPrefsSchema = z
  .object(
    Object.fromEntries(notificationTypeEnum.enumValues.map((t) => [t, z.boolean().optional()])),
  )
  .strict();

export type NotificationPrefsInput = z.infer<typeof notificationPrefsSchema>;
