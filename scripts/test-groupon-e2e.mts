// Groupon staging E2E battery (synthetic data only).
// Exercises the public claim endpoint and the staff verification state machine
// against a running staging instance. No real charges, no real vouchers, no
// sensitive data. Run: npx tsx scripts/test-groupon-e2e.mts <base-url>
// Requires: PK_GrouponRedemption table reachable; ADMIN session cookie in
// PK_ADMIN_COOKIE for the staff steps (skipped gracefully when absent).
const BASE = process.argv[2] || "http://localhost:3000";

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    pass += 1;
    console.log(`PASS ${name}`);
  } else {
    fail += 1;
    console.log(`FAIL ${name}${detail ? ` :: ${detail}` : ""}`);
  }
}

async function post(body: Record<string, unknown>) {
  const res = await fetch(`${BASE}/api/groupon/claim`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

const uniq = Date.now().toString(36);
const EMAIL = `groupon-e2e-${uniq}@example.test`;

async function main() {
  // 1. Happy path claim (synthetic voucher code, synthetic contact).
  const good = await post({
    redemptionCode: `E2E-${uniq}-AAA`,
    fullName: "E2E Synthetic Tester",
    email: EMAIL,
    phone: "",
  });
  check("claim happy path 200", good.status === 200, JSON.stringify(good.json));
  const claimId = typeof good.json.id === "string" ? good.json.id : "";
  check("claim returns id", claimId.length > 0);

  // 2. Duplicate code rejected 409, no second row.
  const dup = await post({
    redemptionCode: `E2E-${uniq}-AAA`,
    fullName: "E2E Synthetic Tester",
    email: EMAIL,
  });
  check("duplicate code 409", dup.status === 409, JSON.stringify(dup.json));

  // 3. Malformed code rejected 400.
  const badCode = await post({ redemptionCode: "!!", fullName: "E2E Tester", email: EMAIL });
  check("malformed code 400", badCode.status === 400, JSON.stringify(badCode.json));

  // 4. Missing name rejected 400.
  const noName = await post({ redemptionCode: `E2E-${uniq}-BBB`, fullName: "", email: EMAIL });
  check("missing name 400", noName.status === 400, JSON.stringify(noName.json));

  // 5. Invalid email rejected 400.
  const badEmail = await post({
    redemptionCode: `E2E-${uniq}-CCC`,
    fullName: "E2E Tester",
    email: "not-an-email",
  });
  check("invalid email 400", badEmail.status === 400, JSON.stringify(badEmail.json));

  // 6. Sensitive-data reject-before-persist (SSN-shaped string in name).
  const ssn = await post({
    redemptionCode: `E2E-${uniq}-DDD`,
    fullName: "E2E Tester 123-45-6789",
    email: EMAIL,
  });
  check("sensitive data 400", ssn.status === 400, JSON.stringify(ssn.json));

  // 7. Honeypot: silent accept, nothing persisted (no id usable).
  const honeypot = await post({
    website: "http://spam.example",
    redemptionCode: `E2E-${uniq}-EEE`,
    fullName: "Bot Bot",
    email: EMAIL,
  });
  check("honeypot silent 200 no real id", honeypot.status === 200 && honeypot.json.id === "ok", JSON.stringify(honeypot.json));

  // Staff state machine (only with an admin cookie present).
  const cookie = process.env.PK_ADMIN_COOKIE || "";
  if (cookie && claimId) {
    const staff = async (action: string, expectStatus: number) => {
      const res = await fetch(`${BASE}/api/admin/groupon`, {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ id: claimId, action, notes: "E2E synthetic" }),
      });
      return { status: res.status, json: (await res.json().catch(() => ({}))) as Record<string, unknown> };
    };
    const early = await staff("MARK_REDEEMED", 400);
    check("mark-redeemed before approve refused", early.status === 400, JSON.stringify(early.json));
    const approve = await staff("APPROVE", 200);
    check("approve from pending 200", approve.status === 200, JSON.stringify(approve.json));
    const mark = await staff("MARK_REDEEMED", 200);
    check("mark-redeemed after approve 200", mark.status === 200, JSON.stringify(mark.json));
    const reopenAfterRedeem = await staff("REOPEN", 400);
    check("reopen after redeemed refused", reopenAfterRedeem.status === 400, JSON.stringify(reopenAfterRedeem.json));
  } else {
    console.log("SKIP staff state machine (no PK_ADMIN_COOKIE or no claim id)");
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e: unknown) => {
  console.error("battery crashed:", e);
  process.exit(1);
});
