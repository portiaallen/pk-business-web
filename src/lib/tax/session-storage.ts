// PK Tax Division - session storage selection.
//
// Resolution order (fail-closed):
// 1. PK_CI_SYNTHETIC=1 forces the synthetic in-memory store. This is the CI
//    containment switch: tests and previews never touch the persisted layer.
// 2. Owner-configured encrypted persistence: PK_SESSION_ENC_KEY present AND
//    the repository database is configured. Sessions are sealed at rest.
// 3. Anything else refuses: tax intake must never silently fall back to the
//    volatile synthetic store.
"use strict";

import { isDatabaseConfigured } from "@/lib/prisma";
import type { Session } from "@/lib/tax/onboarding-core";
import {
  encryptedStoreReady,
  encryptedTaxSessionStore,
  SessionStoreMisconfigured,
} from "@/lib/tax/encrypted-session-store";
import {
  deleteSyntheticSession,
  getSyntheticSession,
  listSyntheticSessions,
  putSyntheticSession,
  resetSyntheticSessions,
} from "@/lib/tax/session-store";

export type TaxSessionStoreMode = "synthetic" | "encrypted";

export interface TaxSessionStore {
  readonly mode: TaxSessionStoreMode;
  get(sessionId: string): Promise<Session | null>;
  put(session: Session): Promise<void>;
  list(): Promise<Session[]>;
  delete(sessionId: string): Promise<void>;
  reset(): Promise<void>;
}

export const syntheticTaxSessionStore: TaxSessionStore = {
  mode: "synthetic",
  get: async (id) => getSyntheticSession(id),
  put: async (session) => { putSyntheticSession(session); },
  list: async () => listSyntheticSessions(),
  delete: async (id) => { deleteSyntheticSession(id); },
  reset: async () => { resetSyntheticSessions(); },
};

export function resolveTaxSessionStore(
  env: Partial<NodeJS.ProcessEnv> = process.env,
  dbConfigured: boolean,
): TaxSessionStore {
  if ((env.PK_CI_SYNTHETIC ?? "").trim() === "1") return syntheticTaxSessionStore;
  if (encryptedStoreReady(env) && dbConfigured) return encryptedTaxSessionStore;
  throw new SessionStoreMisconfigured(
    "Tax session persistence is not configured (PK_SESSION_ENC_KEY + DATABASE_URL required); synthetic fallback is refused outside PK_CI_SYNTHETIC=1.",
  );
}

export function getTaxSessionStore(): TaxSessionStore {
  return resolveTaxSessionStore(process.env, isDatabaseConfigured());
}

// Route helper: turns the fail-closed misconfiguration into an explicit 503
// instead of an unhandled 500, and re-raises everything else untouched.
export function taxSessionStoreOrThrow(): TaxSessionStore {
  try {
    return getTaxSessionStore();
  } catch (error) {
    if (error instanceof SessionStoreMisconfigured) {
      const response = {
        error: "TAX_SESSION_STORE_UNCONFIGURED",
        note: "Encrypted session persistence is not configured; tax intake refuses to run.",
      };
      // Throwing a Response-shaped error is the least invasive fail-closed
      // path for the route handlers to relay.
      throw Object.assign(new Error("TAX_SESSION_STORE_UNCONFIGURED"), { status: 503, response });
  }
    throw error;
  }
}
