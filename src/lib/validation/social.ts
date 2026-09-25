import { z } from "zod";
import { config } from "../config";
import { normalizeUrl } from "../utils";

/** Optional http(s) URL: validated before it is normalised. */
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

export const updateFreelancerProfileSchema = z
  .object({
    headline: z.string().trim().max(160).optional(),
    bio: z.string().trim().max(4000).optional(),
    hourlyRateCents: z.number().int().min(0).nullable().optional(),
    country: z.string().trim().max(80).optional(),
    city: z.string().trim().max(80).optional(),
    availability: z.enum(["AVAILABLE", "BUSY", "UNAVAILABLE"]).optional(),
    yearsExperience: z.number().int().min(0).max(60).optional(),
    portfolioUrl: urlField("Portfolio URL"),
    githubUrl: urlField("GitHub URL"),
    linkedinUrl: urlField("LinkedIn URL"),
    skills: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  })
  .strict();

export type UpdateFreelancerProfileInput = z.infer<typeof updateFreelancerProfileSchema>;

export const updateClientProfileSchema = z
  .object({
    companyName: z.string().trim().max(160).optional(),
    website: urlField("Website"),
    bio: z.string().trim().max(4000).optional(),
    country: z.string().trim().max(80).optional(),
    city: z.string().trim().max(80).optional(),
  })
  .strict();

export type UpdateClientProfileInput = z.infer<typeof updateClientProfileSchema>;

export const startThreadSchema = z
  .object({
    /** Exactly one anchor must be supplied — a proposal, a contract or a project. */
    proposalId: z.string().uuid().optional(),
    contractId: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
    subject: z.string().trim().min(3).max(160).optional(),
    body: z.string().trim().min(1).max(config.limits.messageBody),
  })
  .strict()
  .refine((data) => data.proposalId || data.contractId || data.projectId, {
    message: "A conversation must be attached to a proposal, contract or project.",
  });

export type StartThreadInput = z.infer<typeof startThreadSchema>;

export const sendMessageSchema = z
  .object({
    threadId: z.string().uuid(),
    body: z.string().trim().min(1, "Write a message first.").max(config.limits.messageBody),
  })
  .strict();

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const createReviewSchema = z
  .object({
    contractId: z.string().uuid(),
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().max(config.limits.reviewComment).optional(),
  })
  .strict();

export type CreateReviewInput = z.infer<typeof createReviewSchema>;

export const markNotificationsReadSchema = z
  .object({
    ids: z.array(z.string().uuid()).min(1).max(100).optional(),
    all: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Boolean(data.ids?.length) || data.all === true, {
    message: "Provide notification ids or set all=true.",
  });

export type MarkNotificationsReadInput = z.infer<typeof markNotificationsReadSchema>;
