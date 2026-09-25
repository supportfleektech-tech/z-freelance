import { z } from "zod";
import { config } from "../config";

/** UUID path parameter, reused by every `/[id]` route. */
export const idParamSchema = z.object({
  id: z.string().uuid("Must be a valid identifier."),
});

export type IdParam = z.infer<typeof idParamSchema>;

/** Shared pagination + search query shape. */
export const listQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .max(config.limits.maxPageSize)
      .default(config.limits.pageSize),
    q: z.string().trim().max(200).optional(),
    sort: z.enum(["newest", "oldest", "relevant"]).default("newest"),
  })
  .strict();

export type ListQuery = z.infer<typeof listQuerySchema>;

/** Coerce "" -> undefined so optional filters can be cleared from the UI. */
export const optionalTrimmed = z
  .string()
  .trim()
  .transform((v) => (v.length === 0 ? undefined : v));
