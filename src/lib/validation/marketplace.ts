import { z } from "zod";
import { config } from "../config";

const cents = z.number().int("Amounts must be whole cents.").nonnegative();

export const projectStatusSchema = z.enum(["DRAFT", "OPEN", "IN_PROGRESS", "CLOSED", "CANCELLED"]);

const projectFields = z
  .object({
    title: z
      .string()
      .trim()
      .min(10, "Give the project a descriptive title.")
      .max(config.limits.projectTitle),
    description: z
      .string()
      .trim()
      .min(40, "Describe the work in at least 40 characters so freelancers can bid accurately.")
      .max(config.limits.projectDescription),
    categoryId: z.string().uuid().optional(),
    budgetType: z.enum(["FIXED", "HOURLY"]).default("FIXED"),
    budgetMinCents: cents.nullable().optional(),
    budgetMaxCents: cents.nullable().optional(),
    experienceLevel: z.enum(["ENTRY", "INTERMEDIATE", "EXPERT"]).default("INTERMEDIATE"),
    deadline: z.coerce.date().optional(),
    skills: z
      .array(z.string().trim().min(1).max(80))
      .max(config.limits.skillsPerProject)
      .default([]),
    /** Publish immediately, or keep as a draft the client can edit first. */
    publish: z.boolean().default(true),
  })
  .strict();

export const createProjectSchema = projectFields
  .refine((data) => data.budgetMinCents == null || data.budgetMinCents > 0, {
    message: "The minimum budget must be greater than zero.",
    path: ["budgetMinCents"],
  })
  .refine(
    (data) =>
      data.budgetMinCents == null ||
      data.budgetMaxCents == null ||
      data.budgetMinCents <= data.budgetMaxCents,
    { message: "The minimum budget cannot exceed the maximum.", path: ["budgetMaxCents"] },
  )
  .refine((data) => data.deadline == null || data.deadline.getTime() > Date.now(), {
    message: "The deadline must be in the future.",
    path: ["deadline"],
  });

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

/** Editing a project is only allowed while it is a DRAFT. */
export const updateProjectSchema = projectFields.omit({ publish: true }).partial().strict();

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const projectQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .max(config.limits.maxPageSize)
      .default(config.limits.pageSize),
    q: z.string().trim().max(200).optional(),
    categoryId: z.string().uuid().optional(),
    skill: z.string().trim().max(80).optional(),
    budgetType: z.enum(["FIXED", "HOURLY"]).optional(),
    experienceLevel: z.enum(["ENTRY", "INTERMEDIATE", "EXPERT"]).optional(),
    budgetMinCents: z.coerce.number().int().min(0).optional(),
    budgetMaxCents: z.coerce.number().int().min(0).optional(),
    sort: z.enum(["newest", "budget_high", "budget_low", "proposals"]).default("newest"),
    status: z.enum(["OPEN", "IN_PROGRESS", "CLOSED", "CANCELLED", "DRAFT"]).optional(),
  })
  .strict();

export type ProjectQuery = z.infer<typeof projectQuerySchema>;

export const createProposalSchema = z
  .object({
    coverLetter: z
      .string()
      .trim()
      .min(80, "A strong proposal explains your approach — at least 80 characters, please.")
      .max(config.limits.coverLetter),
    bidAmountCents: z
      .number()
      .int("Bids must be whole cents.")
      .min(config.minBidCents, "That bid is below the platform minimum."),
    estimatedDays: z.number().int().min(1).max(365).default(14),
  })
  .strict();

export type CreateProposalInput = z.infer<typeof createProposalSchema>;

export const proposalDecisionSchema = z
  .object({
    decision: z.enum(["SHORTLIST", "REJECT", "HIRE"]),
  })
  .strict();

export type ProposalDecisionInput = z.infer<typeof proposalDecisionSchema>;

export const freelancerQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .max(config.limits.maxPageSize)
      .default(config.limits.pageSize),
    q: z.string().trim().max(200).optional(),
    skill: z.string().trim().max(80).optional(),
    maxRateCents: z.coerce.number().int().min(0).optional(),
    minRating: z.coerce.number().int().min(0).max(5).optional(),
    availability: z.enum(["AVAILABLE", "BUSY", "UNAVAILABLE"]).optional(),
    sort: z.enum(["rating", "rate_low", "rate_high", "newest"]).default("rating"),
  })
  .strict();

export type FreelancerQuery = z.infer<typeof freelancerQuerySchema>;
