import { z } from "zod";

/**
 * Runtime environment validation.
 *
 * Every value the application reads from `process.env` is declared here so a
 * misconfigured deployment fails fast at boot with an actionable message
 * instead of surfacing as a mysterious runtime error.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  /** Canonical public origin, e.g. https://app.zfreelance.dev — used for links and CORS. */
  APP_URL: z.string().url().default("http://localhost:3000"),

  /** Secret used to sign session JWTs. Must be at least 32 chars in production. */
  SESSION_SECRET: z.string().min(1).default("dev-only-insecure-session-secret-change-me"),

  /** Cookie name for the session token. */
  SESSION_COOKIE: z.string().min(1).default("zf_session"),

  /** Session lifetime in seconds (default 7 days). */
  SESSION_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60 * 24 * 7),

  /**
   * Postgres connection string. When present the app uses `node-postgres`.
   * When absent the app falls back to an embedded PGlite database, which makes
   * local development and CI possible without a database server.
   */
  DATABASE_URL: z.string().optional(),

  /** Directory used by the embedded PGlite database. */
  PGLITE_DATA_DIR: z.string().min(1).default(".pgdata"),

  /**
   * Directory where user-uploaded files are stored. Relative paths resolve
   * against the server process cwd — set an absolute path in production
   * (the Docker image uses /data/uploads).
   */
  UPLOAD_DIR: z.string().min(1).default(".uploads"),

  /** Maximum accepted upload size, in bytes (default 10 MiB). */
  UPLOAD_MAX_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .max(100 * 1024 * 1024)
    .default(10 * 1024 * 1024),

  /** bcrypt cost factor. Lowered in tests for speed. */
  PASSWORD_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),

  /** Platform take rate, in basis points (1000 = 10%). */
  PLATFORM_FEE_BPS: z.coerce.number().int().min(0).max(5000).default(1000),

  /** ISO currency code used across the platform. */
  CURRENCY: z.string().length(3).default("USD"),

  /** Minimum accepted proposal bid, in cents. */
  MIN_BID_CENTS: z.coerce.number().int().min(0).default(500),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/** Read and validate the environment exactly once per process. */
export function env(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Test helper: reset the memoised env so tests can vary process.env. */
export function __resetEnvCache(): void {
  cached = undefined;
}
