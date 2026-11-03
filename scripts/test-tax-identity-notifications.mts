// Synthetic-only battery for preparer-reviewed identity verification and
// preparer notifications (founder-approved configuration, 2026-10-19).
// Containment: PK_CI_SYNTHETIC=1, no database, no real taxpayer data, and
// identity document CONTENTS never enter this engine anywhere in this battery.
// Run: npm run test:tax:identity
import test from "node:test";
import assert from "node:assert/strict";
import {
  attest,
  canTransmit,
  closeAccess,
  createSession,
  markNotificationsRead,
  notifyPreparer,
  preparerGrantAccess,
  preparerQueueRow,
  preparerVerifyIdentity,
  requestIdentityVerification,
  submitIdentityDocuments,
  uploadDocument,
} from "../src/lib/tax/onboarding-core";

process.env.PK_CI_SYNTHETIC = "1";

test("client can only request identity review; preparer opens access", () => {
  const s = createSession();
  assert.equal(s.identity.status, "none");
  assert.equal(preparerGrantAccess(s, "pk"), false, "no request yet: fail closed");
  assert.equal(uploadDocument(s, { name: "w2.pdf" }), false, "no access: fail closed");
  assert.equal(submitIdentityDocuments(s), false, "no access: fail closed");
  assert.equal(requestIdentityVerification(s), true);
  assert.equal(s.identity.status, "requested");
  assert.equal(requestIdentityVerification(s), false, "no duplicate requests");
  assert.equal(preparerGrantAccess(s, "pk"), true);
  assert.equal(s.access.granted, true);
  const events = s.audit.map((a) => a.event);
  assert(events.includes("identity_review_requested"));
  assert(events.includes("access_granted"));
});

test("ID documents only through the secure process after access", () => {
  const s = createSession();
  requestIdentityVerification(s);
  preparerGrantAccess(s, "pk");
  assert.equal(submitIdentityDocuments(s), true);
  assert.equal(submitIdentityDocuments(s), true);
  assert.equal(s.identity.docCount, 2);
  assert.equal(s.identity.documentsSubmitted, true);
  closeAccess(s);
  assert.equal(submitIdentityDocuments(s), false, "closed access: fail closed");
});

test("preparer verification requires submitted documents", () => {
  const s = createSession();
  requestIdentityVerification(s);
  preparerGrantAccess(s, "pk");
  assert.equal(preparerVerifyIdentity(s, "pk", true), false, "no ID documents yet");
  assert.equal(s.gates.identity_verified, false);
  assert.equal(submitIdentityDocuments(s), true);
  assert.equal(preparerVerifyIdentity(s, "pk", true, "documents match intake"), true);
  assert.equal(s.identity.status, "verified");
  assert.equal(s.identity.reviewedBy, "pk");
  assert.equal(s.gates.identity_verified, true);
  assert.equal(canTransmit(s).allowed, false, "identity verified alone does not open transmission");
});

test("rejection closes the review; no re-request on the same session", () => {
  const s = createSession();
  requestIdentityVerification(s);
  preparerGrantAccess(s, "pk");
  submitIdentityDocuments(s);
  assert.equal(preparerVerifyIdentity(s, "pk", false, "documents do not match intake"), true);
  assert.equal(s.identity.status, "rejected");
  assert.equal(s.gates.identity_verified, false);
  assert.equal(requestIdentityVerification(s), false, "rejected review is final on this session");
  assert.equal(preparerVerifyIdentity(s, "pk", true), false, "nothing left to verify");
});

test("identity gate blocks transmission until the preparer clears it", () => {
  const s = createSession();
  const before = canTransmit(s);
  assert(before.reasons.includes("identity_verified"));
  for (const g of Object.keys(s.gates) as Array<keyof typeof s.gates>) s.gates[g] = true;
  assert.equal(canTransmit(s).allowed, true);
});

test("preparer notifications record the client milestones", () => {
  const s = createSession();
  requestIdentityVerification(s);
  preparerGrantAccess(s, "pk");
  uploadDocument(s, { name: "w2.pdf" });
  submitIdentityDocuments(s);
  attest(s);
  const events = s.notifications.map((n) => n.event);
  assert(events.includes("identity_requested"));
  assert(events.includes("documents_logged"));
  assert(events.includes("identity_documents"));
  assert(events.includes("client_attestation"));
  assert.equal(markNotificationsRead(s), 4);
  assert.equal(s.notifications.every((n) => n.read), true);
  assert.equal(markNotificationsRead(s), 0);
});

test("preparer queue row is metadata-only", () => {
  const s = createSession();
  requestIdentityVerification(s);
  preparerGrantAccess(s, "pk");
  submitIdentityDocuments(s);
  const row = preparerQueueRow(s);
  assert.equal(row.sessionId, s.sessionId);
  assert.equal((row.identity as { status: string }).status, "requested");
  assert.equal((row.identity as { docCount: number }).docCount, 1);
  assert.equal((row.notificationsPending as number) >= 1, true);
  const raw = JSON.stringify(row);
  assert(!raw.includes("w2.pdf"), "queue rows carry no document contents");
  assert(!raw.includes("answers"), "queue rows carry no answer payloads");
});

test("notifyPreparer is id-safe and audit-linked", () => {
  const s = createSession();
  notifyPreparer(s, "manual_ping", "test");
  const n = s.notifications[0];
  assert(n.id.length > 0);
  assert.equal(n.read, false);
  assert(s.audit.some((a) => a.event === "preparer_notified"));
});
