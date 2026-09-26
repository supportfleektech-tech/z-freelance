import bcrypt from "bcryptjs";
import { env } from "../env";

/**
 * Password hashing.
 *
 * bcrypt with a configurable cost factor (`PASSWORD_ROUNDS`). The cost is
 * deliberately lowered by the test suite so suites stay fast; production keeps
 * the default of 12 (~250ms per hash on commodity hardware), which is the
 * currently recommended bcrypt work factor.
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env().PASSWORD_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  // `bcrypt.compare` throws on malformed hashes; treat that as a failed login
  // rather than leaking a 500 to a caller probing accounts.
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/**
 * Constant-work dummy comparison used to avoid a user-enumeration timing
 * oracle: when the e-mail is unknown we still pay for one bcrypt round.
 */
const DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEeO1uQnTz0rJmZ0yQx0Y0z0Y0z0Y0z0Y0u";

export async function verifyAgainstDummy(plain: string): Promise<void> {
  await bcrypt.compare(plain, DUMMY_HASH).catch(() => false);
}
