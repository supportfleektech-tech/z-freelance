import { env } from "./env";

/** Application-wide tunables that are not secret and rarely change. */
export const config = {
  name: "z-freelance",
  tagline: "Hire great freelancers. Get paid for great work.",
  /** Platform take rate applied to every released milestone. */
  get platformFeeBps(): number {
    return env().PLATFORM_FEE_BPS;
  },
  get currency(): string {
    return env().CURRENCY;
  },
  get minBidCents(): number {
    return env().MIN_BID_CENTS;
  },
  /** Absolute path of the upload storage directory (resolved lazily). */
  get uploadDir(): string {
    return env().UPLOAD_DIR;
  },
  get uploadMaxBytes(): number {
    return env().UPLOAD_MAX_BYTES;
  },
  limits: {
    projectTitle: 160,
    projectDescription: 8000,
    coverLetter: 4000,
    messageBody: 4000,
    reviewComment: 2000,
    reviewResponse: 1500,
    skillsPerProject: 8,
    milestonesPerContract: 20,
    portfolioTitle: 140,
    portfolioDescription: 2000,
    portfolioItemsPerFreelancer: 20,
    attachmentsPerPost: 5,
    uploadFileName: 240,
    pageSize: 12,
    maxPageSize: 50,
  },
  /** Rate limits for unauthenticated endpoints (window ms / max hits). */
  rateLimits: {
    auth: { windowMs: 60_000, max: 20 },
    api: { windowMs: 60_000, max: 300 },
  },
} as const;
