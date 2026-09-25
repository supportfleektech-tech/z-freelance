import { z } from "zod";
import { config } from "../config";

const positiveCents = z
  .number()
  .int("Amounts must be whole cents.")
  .positive("Amounts must be greater than zero.");

export const createMilestoneSchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    description: z.string().trim().max(4000).optional(),
    amountCents: positiveCents,
    dueDate: z.coerce.date().optional(),
    position: z.number().int().min(1).max(config.limits.milestonesPerContract).optional(),
  })
  .strict();

export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;

/**
 * A milestone plan must exactly cover the contract value — this is what keeps
 * escrow honest: money in equals money out, with no remainder to argue about.
 */
export const createMilestonePlanSchema = z
  .object({
    milestones: z
      .array(createMilestoneSchema)
      .min(1, "Add at least one milestone.")
      .max(config.limits.milestonesPerContract),
  })
  .strict();

export type CreateMilestonePlanInput = z.infer<typeof createMilestonePlanSchema>;

export const submitWorkSchema = z
  .object({
    submissionNote: z
      .string()
      .trim()
      .min(10, "Add a short note describing what you delivered.")
      .max(4000),
  })
  .strict();

export type SubmitWorkInput = z.infer<typeof submitWorkSchema>;

export const openDisputeSchema = z
  .object({
    milestoneId: z.string().uuid().optional(),
    reason: z
      .string()
      .trim()
      .min(20, "Give our team enough detail to review the dispute.")
      .max(2000),
  })
  .strict();

export type OpenDisputeInput = z.infer<typeof openDisputeSchema>;

export const resolveDisputeSchema = z
  .object({
    outcome: z.enum(["RESOLVED_CLIENT", "RESOLVED_FREELANCER"]),
    resolutionNote: z.string().trim().min(10).max(2000),
  })
  .strict();

export type ResolveDisputeInput = z.infer<typeof resolveDisputeSchema>;

export const requestPayoutSchema = z
  .object({
    amountCents: positiveCents.optional(),
    method: z.enum(["BANK_TRANSFER", "PAYPAL", "WISE"]).default("BANK_TRANSFER"),
  })
  .strict();

export type RequestPayoutInput = z.infer<typeof requestPayoutSchema>;

export const cancelContractSchema = z
  .object({
    reason: z.string().trim().min(5).max(1000),
  })
  .strict();

export type CancelContractInput = z.infer<typeof cancelContractSchema>;
