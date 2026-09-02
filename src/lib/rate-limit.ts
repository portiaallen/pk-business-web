import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";

/**
 * Persistent login rate limiting backed by the `LoginRateLimit` table.
 *
 * Strategy:
 * - Failed attempts are counted per-email with a sliding window.
 * - After MAX_ATTEMPTS failures within WINDOW_SECONDS, the account is
 *   locked for LOCKOUT_SECONDS (progressive, capped) — not indefinitely,
 *   so legitimate users regain access automatically.
 * - Successful login clears the failed-attempt state entirely.
 * - Always throw a generic ApiError so the response never reveals whether
 *   the account exists (same message as invalid credentials).
 *
 * Because state lives in the database, this works across multiple
 * server instances with no extra infrastructure.
 */

const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 15 * 60; // 15 minutes of failure tracking
const LOCKOUT_BASE_SECONDS = 5 * 60; // 5 minutes initial lockout
const LOCKOUT_MAX_SECONDS = 60 * 60; // 1 hour cap for repeated lockouts

const GENERIC_FAILURE = "Invalid email or password";

function windowStart(): Date {
  return new Date(Date.now() - WINDOW_SECONDS * 1000);
}

/**
 * Check whether the given email is currently rate-limited.
 * Throws 429 (with generic message) if locked; otherwise returns.
 */
export async function assertNotRateLimited(email: string): Promise<void> {
  const record = await prisma.loginRateLimit.findUnique({
    where: { email },
  });

  if (!record) return;

  // Active lockout?
  if (record.lockedUntil && record.lockedUntil > new Date()) {
    throw new ApiError(429, GENERIC_FAILURE);
  }

  // Expired lockout: reset the failure window so stale attempts don't re-lock
  if (record.lockedUntil && record.lockedUntil <= new Date()) {
    await prisma.loginRateLimit.delete({ where: { email } });
  }
}

/**
 * Record a failed login attempt for this email.
 * Locks progressively if the failure threshold is exceeded within the window.
 */
export async function recordFailedLogin(email: string): Promise<void> {
  const now = new Date();
  const record = await prisma.loginRateLimit.findUnique({
    where: { email },
  });

  const recentFailure =
    record?.lastFailedAt && record.lastFailedAt >= windowStart()
      ? record.failedCount + 1
      : 1; // window expired — start fresh

  if (recentFailure >= MAX_ATTEMPTS) {
    // Progressive lockout: escalate with each subsequent lockout event
    const priorLockouts = record?.lockedUntil ? 1 : 0;
    const lockoutSeconds = Math.min(
      LOCKOUT_BASE_SECONDS * Math.pow(2, priorLockouts),
      LOCKOUT_MAX_SECONDS
    );
    const lockedUntil = new Date(now.getTime() + lockoutSeconds * 1000);

    await prisma.loginRateLimit.upsert({
      where: { email },
      create: { email, failedCount: recentFailure, lockedUntil, lastFailedAt: now },
      update: { failedCount: recentFailure, lockedUntil, lastFailedAt: now },
    });
    return;
  }

  await prisma.loginRateLimit.upsert({
    where: { email },
    create: { email, failedCount: recentFailure, lastFailedAt: now },
    update: { failedCount: recentFailure, lastFailedAt: now },
  });
}

/**
 * Clear failed-attempt state after a successful authentication.
 */
export async function clearFailedLogins(email: string): Promise<void> {
  await prisma.loginRateLimit.deleteMany({ where: { email } });
}

/** Generic failure error that never reveals account existence. */
export function genericLoginError(): ApiError {
  return ApiError.unauthorized(GENERIC_FAILURE);
}
