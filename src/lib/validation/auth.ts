import { z } from "zod";

/**
 * Password policy: at least 10 characters containing a letter and a digit.
 * Deliberately not a complexity arms race — length matters more than symbol
 * count, and the message tells the user exactly what failed.
 */
export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(200, "That password is too long.")
  .regex(/[A-Za-z]/, "Include at least one letter.")
  .regex(/[0-9]/, "Include at least one number.");

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address.")
  .max(254);

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Tell us your name.")
  .max(120)
  .regex(/^[\p{L}\p{M}'’.\- ]+$/u, "Names may contain letters, spaces, hyphens and apostrophes.");

export const registerSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    role: z.enum(["CLIENT", "FREELANCER"], {
      errorMap: () => ({ message: "Choose whether you want to hire or get hired." }),
    }),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, "Enter your password.").max(200),
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(200),
    newPassword: passwordSchema,
  })
  .strict();

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
