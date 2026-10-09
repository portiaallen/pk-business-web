import test from "node:test";
import assert from "node:assert/strict";
import { authenticationDatabaseFailureEvent } from "../src/lib/database-diagnostics";
import { logSecurityEvent } from "../src/lib/security-log";

const canary = "SYNTHETIC_PRIVATE_CANARY?token=DO_NOT_LOG";
for (const [code, category] of [
  ["UNAUTHORIZED", "AUTHORIZATION"], ["P1000", "AUTHORIZATION"],
  ["P2021", "SCHEMA"], ["P2022", "SCHEMA"],
  ["FETCH_FAILED", "TRANSPORT"], ["ECONNREFUSED", "TRANSPORT"],
]) test(`fixed category for ${code}`, () => {
  assert.equal(authenticationDatabaseFailureEvent({ code, message: canary, url: canary }), `AUTH_DATABASE_${category}_FAILURE`);
});
test("exact internal configuration errors have fixed category", () => {
  assert.equal(authenticationDatabaseFailureEvent(new Error("Resource security environment is not approved")), "AUTH_DATABASE_CONFIGURATION_FAILURE");
});
test("nested provider code excludes all provider text", () => {
  assert.equal(authenticationDatabaseFailureEvent({ message: canary, cause: { code: "AUTH_TOKEN_EXPIRED", message: canary } }), "AUTH_DATABASE_AUTHORIZATION_FAILURE");
});
test("unknown, cyclic and hostile errors stay generic", () => {
  const cyclic: { cause?: unknown } = {}; cyclic.cause = cyclic;
  for (const error of [null, canary, { code: canary }, cyclic, { get code(): string { throw Error(canary); } }])
    assert.equal(authenticationDatabaseFailureEvent(error), "AUTH_DATABASE_FAILURE");
});
test("logger accepts diagnostic category but never canary content", () => {
  const logs: string[] = []; const previous = console.error;
  try {
    console.error = (value: string) => { logs.push(value); };
    logSecurityEvent(authenticationDatabaseFailureEvent({ code: "UNAUTHORIZED", message: canary }));
    logSecurityEvent(canary);
  } finally { console.error = previous; }
  assert.deepEqual(logs.map(value => JSON.parse(value).event), ["AUTH_DATABASE_AUTHORIZATION_FAILURE", "SECURITY_FAILURE"]);
  assert.ok(!logs.join("").includes(canary));
});
