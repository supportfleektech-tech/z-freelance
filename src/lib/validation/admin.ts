import { z } from "zod";

export const updateUserStatusSchema = z
  .object({
    status: z.enum(["ACTIVE", "SUSPENDED"]),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;

export const createCategorySchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(500).optional(),
  })
  .strict();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const createSkillSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    categoryId: z.string().uuid().optional(),
  })
  .strict();

export type CreateSkillInput = z.infer<typeof createSkillSchema>;

export const adminUserQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    q: z.string().trim().max(200).optional(),
    role: z.enum(["CLIENT", "FREELANCER", "ADMIN"]).optional(),
    status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  })
  .strict();

export type AdminUserQuery = z.infer<typeof adminUserQuerySchema>;
