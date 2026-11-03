// Synthetic in-memory session store for tests and previews ONLY.
// Production replaces this with the owner-configured restricted backend/vault
// adapter and the repository's persisted session layer. Nothing here may hold
// real taxpayer data; this build performs no file or database writes.
"use strict";

import type { Session } from "@/lib/tax/onboarding-core";

const sessions = new Map<string, Session>();

export function getSyntheticSession(id: string): Session | null {
  return sessions.get(id) ?? null;
}

export function listSyntheticSessions(): Session[] {
  return [...sessions.values()];
}

export function putSyntheticSession(s: Session): void {
  sessions.set(s.sessionId, s);
}

export function deleteSyntheticSession(id: string): boolean {
  return sessions.delete(id);
}

export function resetSyntheticSessions(): void {
  sessions.clear();
}
