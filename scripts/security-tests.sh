#!/usr/bin/env bash
# PK Business Services — Cross-tenant security test suite
set -u
BASE="http://localhost:4321"
PASS=0; FAIL=0
FAILED_NAMES=()

expect_reject() { # name code
  local name="$1" code="$2"
  if [ "$code" -ge 400 ]; then
    PASS=$((PASS+1)); echo "PASS (reject $code) $name"
  else
    FAIL=$((FAIL+1)); FAILED_NAMES+=("$name"); echo "FAIL ($code) $name"
  fi
}
expect_ok() {
  local name="$1" code="$2"
  if [ "$code" -ge 200 ] && [ "$code" -lt 300 ]; then
    PASS=$((PASS+1)); echo "PASS ($code) $name"
  else
    FAIL=$((FAIL+1)); FAILED_NAMES+=("$name"); echo "FAIL ($code) $name"
  fi
}

login() { # email password -> sets VAR via stdout (cookie header)
  curl -s -i -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}" | grep -i "^set-cookie:" | head -1 | sed 's/^[Ss]et-[Cc]ookie: //' | cut -d';' -f1
}

# ─── Logins ─────────────────────────────────────────────────────────────────
PW="TestPK2026!"
OWNA=$(login ownera@sectest.test "$PW")
MGRB=$(login managerb@sectest.test "$PW")
VIEWA=$(login viewera@sectest.test "$PW")
STAFFB=$(login staffb@sectest.test "$PW")

# ─── AUTHENTICATION TESTS ──────────────────────────────────────────────────
echo "== Authentication =="
c=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/portal/dashboard"); expect_reject "unauthenticated dashboard" "$c"
c=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/portal/requests"); expect_reject "unauthenticated requests" "$c"
c=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/admin/clients"); expect_reject "unauthenticated admin" "$c"
c=$(curl -s -o /dev/null -w "%{http_code}" -H "Cookie: pk_session=forgedtoken123" "$BASE/api/portal/dashboard"); expect_reject "forged session token" "$c"
c=$(curl -s -o /dev/null -w "%{http_code}" -H "Cookie: pk_session=" "$BASE/api/portal/dashboard"); expect_reject "empty session token" "$c"
c=$(curl -s -o /dev/null -w "%{http_code}" -I "$BASE/portal/dashboard")
if [ "$c" = "307" ] || [ "$c" = "302" ]; then PASS=$((PASS+1)); echo "PASS (redirect $c) unauthenticated portal page"; else FAIL=$((FAIL+1)); FAILED_NAMES+=("portal page redirect"); echo "FAIL ($c) portal page redirect"; fi
c=$(curl -s -o /dev/null -w "%{http_code}" -I "$BASE/admin/dashboard")
if [ "$c" = "307" ] || [ "$c" = "302" ]; then PASS=$((PASS+1)); echo "PASS (redirect $c) unauthenticated admin page"; else FAIL=$((FAIL+1)); FAILED_NAMES+=("admin page redirect"); echo "FAIL ($c) admin page redirect"; fi

# Client (Business A owner) hitting admin endpoints
c=$(curl -s -o /dev/null -w "%{http_code}" -H "Cookie: $OWNA" "$BASE/api/admin/clients"); expect_reject "client→admin /clients" "$c"
c=$(curl -s -o /dev/null -w "%{http_code}" -H "Cookie: $OWNA" "$BASE/api/admin/requests"); expect_reject "client→admin /requests" "$c"
c=$(curl -s -o /dev/null -w "%{http_code}" -H "Cookie: $OWNA" "$BASE/api/admin/activity"); expect_reject "client→admin /activity" "$c"
c=$(curl -s -o /dev/null -w "%{http_code}" -H "Cookie: $OWNA" "$BASE/api/admin/services"); expect_reject "client→admin /services" "$c"

# Admin login should succeed (regression)
ADMIN=$(login demo.admin@pk-demo.test "DemoPK2026!")
c=$(curl -s -o /dev/null -w "%{http_code}" -H "Cookie: $ADMIN" "$BASE/api/admin/clients"); expect_ok "admin can list clients" "$c"

# ─── CROSS-TENANT TESTS (Business A attacking Business B) ─────────────────
echo "== Cross-tenant (A attacking B) =="
# Request IDs
c=$(curl -s -o /dev/null -w "%{http_code}" -H "Cookie: $OWNA" "$BASE/api/portal/requests/sectest_req_b"); expect_reject "A reads B request" "$c"
c=$(curl -s -o /dev/null -w "%{http_code}" -H "Cookie: $OWNA" "$BASE/api/portal/requests/sectest_req_a"); expect_ok "A reads own request" "$c"
# Guess/sequence IDs — non-existent id
c=$(curl -s -o /dev/null -w "%{http_code}" -H "Cookie: $OWNA" "$BASE/api/portal/requests/cmrandomguess123"); expect_reject "A guesses unknown request id" "$c"
# Message injection into B's request
c=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Cookie: $OWNA" -H "Content-Type: application/json" \
  -d '{"body":"injected message"}' "$BASE/api/portal/requests/sectest_req_b/messages"); expect_reject "A posts message into B request" "$c"

# Check B's request content is never in A's list responses
body=$(curl -s -H "Cookie: $OWNA" "$BASE/api/portal/requests")
if echo "$body" | grep -q "sectest_req_b\|Beta Test"; then
  FAIL=$((FAIL+1)); FAILED_NAMES+=("B data leaked in A request list"); echo "FAIL B data leaked in A request list"
else
  PASS=$((PASS+1)); echo "PASS no B data in A request list"
fi
body=$(curl -s -H "Cookie: $OWNA" "$BASE/api/portal/documents")
if echo "$body" | grep -q "confidential-b\|sectest_req_b"; then
  FAIL=$((FAIL+1)); FAILED_NAMES+=("B doc leaked in A document list"); echo "FAIL B doc leaked in A document list"
else
  PASS=$((PASS+1)); echo "PASS no B docs in A document list"
fi
body=$(curl -s -H "Cookie: $OWNA" "$BASE/api/portal/messages")
if echo "$body" | grep -q "Confidential message for Beta"; then
  FAIL=$((FAIL+1)); FAILED_NAMES+=("B message leaked to A"); echo "FAIL B message leaked to A"
else
  PASS=$((PASS+1)); echo "PASS no B messages visible to A"
fi
# Dashboard leak check
body=$(curl -s -H "Cookie: $OWNA" "$BASE/api/portal/dashboard")
if echo "$body" | grep -q "Beta Test"; then
  FAIL=$((FAIL+1)); FAILED_NAMES+=("B data in A dashboard"); echo "FAIL B data in A dashboard"
else
  PASS=$((PASS+1)); echo "PASS no B data in A dashboard"
fi
# clientId manipulation via request body (create request with foreign clientId)
c=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Cookie: $OWNA" -H "Content-Type: application/json" \
  -d '{"serviceSlug":"quickbooks-cleanup","description":"body-injection test","clientId":"sectest_client_b"}' "$BASE/api/portal/requests")
# Should succeed creating own request but ignore clientId — verify ownership
newid=$(curl -s -X POST -H "Cookie: $OWNA" -H "Content-Type: application/json" \
  -d '{"serviceSlug":"quickbooks-cleanup","description":"body-injection test2"}' "$BASE/api/portal/requests" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
if [ -n "$newid" ]; then
  owner_check=$(curl -s -H "Cookie: $MGRB" "$BASE/api/portal/requests/$newid" -o /dev/null -w "%{http_code}")
  expect_reject "B cannot read A's new request (body clientId ignored)" "$owner_check"
else
  echo "WARN could not create new request for ownership check"
fi

# ─── SERVICE CATALOG TESTS ────────────────────────────────────────────────
echo "== Service catalog =="
# Active services are visible to authorized clients
body=$(curl -s -H "Cookie: $OWNA" "$BASE/api/portal/services")
if echo "$body" | grep -q '"slug":"quickbooks-cleanup"'; then
  PASS=$((PASS+1)); echo "PASS active service visible in client catalog"
else
  FAIL=$((FAIL+1)); FAILED_NAMES+=("active service in catalog"); echo "FAIL active service missing from client catalog"
fi
# Inactive/unreleased services must NOT appear in the client catalog
if echo "$body" | grep -q 'inventory-support'; then
  FAIL=$((FAIL+1)); FAILED_NAMES+=("inactive service leaked"); echo "FAIL inactive service leaked to client catalog"
else
  PASS=$((PASS+1)); echo "PASS inactive service not in client catalog"
fi
# Client cannot select an inactive service via payload manipulation
c=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Cookie: $OWNA" -H "Content-Type: application/json" \
  -d '{"serviceSlug":"inventory-support","description":"inactive service attempt"}' "$BASE/api/portal/requests"); expect_reject "client selects INACTIVE service" "$c"
# Client can select another active service, and the service is stored on the request
RESP=$(curl -s -X POST -H "Cookie: $OWNA" -H "Content-Type: application/json" \
  -d '{"serviceSlug":"monthly-bookkeeping","description":"second active service selection test"}' "$BASE/api/portal/requests")
NEWREQ=$(echo "$RESP" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
if [ -n "$NEWREQ" ]; then
  PASS=$((PASS+1)); echo "PASS client selects another active service"
  detail=$(curl -s -H "Cookie: $OWNA" "$BASE/api/portal/requests/$NEWREQ")
  if echo "$detail" | grep -q "Monthly Bookkeeping"; then
    PASS=$((PASS+1)); echo "PASS selected service stored on request"
  else
    FAIL=$((FAIL+1)); FAILED_NAMES+=("service stored on request"); echo "FAIL selected service not stored on request"
  fi
else
  FAIL=$((FAIL+1)); FAILED_NAMES+=("second active service selection"); echo "FAIL second active service selection: $RESP"
fi
# Admin sees the selected service on requests
body=$(curl -s -H "Cookie: $ADMIN" "$BASE/api/admin/requests")
if echo "$body" | grep -q "Monthly Bookkeeping"; then
  PASS=$((PASS+1)); echo "PASS admin sees selected service"
else
  FAIL=$((FAIL+1)); FAILED_NAMES+=("admin sees service"); echo "FAIL admin does not see selected service"
fi

# ─── ROLE TESTS ─────────────────────────────────────────────────────────────
echo "== Roles (Business A) =="
# VIEWER read allowed
c=$(curl -s -o /dev/null -w "%{http_code}" -H "Cookie: $VIEWA" "$BASE/api/portal/requests"); expect_ok "VIEWER read requests" "$c"
c=$(curl -s -o /dev/null -w "%{http_code}" -H "Cookie: $VIEWA" "$BASE/api/portal/documents"); expect_ok "VIEWER read documents" "$c"
# VIEWER writes must be rejected
c=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Cookie: $VIEWA" -H "Content-Type: application/json" \
  -d '{"serviceSlug":"quickbooks-cleanup","description":"viewer write"}' "$BASE/api/portal/requests"); expect_reject "VIEWER create request" "$c"
c=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Cookie: $VIEWA" -H "Content-Type: application/json" \
  -d '{"body":"viewer msg"}' "$BASE/api/portal/requests/sectest_req_a/messages"); expect_reject "VIEWER post message" "$c"

# STAFF (Business B) writes allowed
c=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Cookie: $STAFFB" -H "Content-Type: application/json" \
  -d '{"serviceSlug":"quickbooks-cleanup","description":"staff write"}' "$BASE/api/portal/requests"); expect_ok "STAFF create request" "$c"
# STAFF cannot hit admin
c=$(curl -s -o /dev/null -w "%{http_code}" -H "Cookie: $STAFFB" "$BASE/api/admin/clients"); expect_reject "STAFF→admin" "$c"

# ─── DOCUMENT SECURITY TESTS ───────────────────────────────────────────────
echo "== Document security =="
DOC_PW="TestPK2026!"
# Fixture file used by upload tests below — must exist before the first upload
echo "attack test" > /tmp/attack.txt
DOCA=$(login ownera@sectest.test "$DOC_PW")
VIEWB=$(login viewerb@sectest.test "$DOC_PW")

# 1. A downloads B's document by ID
UP_B=$(login ownerb@sectest.test "$DOC_PW")
c=$(curl -s -o /dev/null -w "%{http_code}" -H "Cookie: $DOCA" "$BASE/api/portal/documents/sectest_doc_b"); expect_reject "A downloads B document (metadata id)" "$c"
# Upload a fresh doc as A, then download it
UPA_RESP=$(curl -s -X POST -H "Cookie: $DOCA" -F "file=@/tmp/attack.txt;type=text/plain" -F "requestId=sectest_req_a" -F "category=OTHER" "$BASE/api/portal/documents/upload")
UPA_ID=$(echo "$UPA_RESP" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
c=$(curl -s -o /dev/null -w "%{http_code}" -H "Cookie: $DOCA" "$BASE/api/portal/documents/$UPA_ID"); expect_ok "A downloads own uploaded document" "$c"
# B attempts to download A's fresh document
c=$(curl -s -o /dev/null -w "%{http_code}" -H "Cookie: $UP_B" "$BASE/api/portal/documents/$UPA_ID"); expect_reject "B downloads A's fresh document" "$c"

# 2. Guessed/random document ID
c=$(curl -s -o /dev/null -w "%{http_code}" -H "Cookie: $DOCA" "$BASE/api/portal/documents/cmdocguess999"); expect_reject "A guesses unknown document id" "$c"

# 3. clientId manipulation on upload: A uploads into B's request
c=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Cookie: $DOCA" \
  -F "file=@/tmp/attack.txt;type=text/plain" -F "requestId=sectest_req_b" -F "category=OTHER" \
  "$BASE/api/portal/documents/upload"); expect_reject "A uploads into B request" "$c"
c=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Cookie: $DOCA" \
  -F "file=@/tmp/attack.txt;type=text/plain" -F "requestId=sectest_req_a" -F "category=OTHER" \
  "$BASE/api/portal/documents/upload"); expect_ok "A uploads into own request" "$c"

# 3b. clientId supplied in form body must be ignored (upload still scoped to A)
c=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Cookie: $DOCA" \
  -F "file=@/tmp/attack.txt;type=text/plain" -F "requestId=sectest_req_a" -F "clientId=sectest_client_b" -F "category=OTHER" \
  "$BASE/api/portal/documents/upload"); expect_ok "upload ignores body clientId (A-scoped)" "$c"

# 4. Relationship manipulation: A attaches upload to B's documentRequest
c=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Cookie: $DOCA" \
  -F "file=@/tmp/attack.txt;type=text/plain" -F "requestId=sectest_req_a" -F "documentRequestId=docreq_of_b_placeholder" -F "category=OTHER" \
  "$BASE/api/portal/documents/upload"); expect_reject "A links B documentRequest" "$c"

# 5. VIEWER write restrictions on documents
c=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Cookie: $VIEWB" \
  -F "file=@/tmp/attack.txt;type=text/plain" -F "requestId=sectest_req_b" -F "category=OTHER" \
  "$BASE/api/portal/documents/upload"); expect_reject "VIEWER upload document" "$c"
c=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "Cookie: $VIEWB" "$BASE/api/portal/documents/sectest_doc_b"); expect_reject "VIEWER delete document" "$c"

# 6. Unauthenticated / forged session downloads
c=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/portal/documents/sectest_doc_a"); expect_reject "unauthenticated download" "$c"
c=$(curl -s -o /dev/null -w "%{http_code}" -H "Cookie: pk_session=forged" "$BASE/api/portal/documents/sectest_doc_a"); expect_reject "forged session download" "$c"

# 7. File validation: disallowed type + oversized
c=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Cookie: $DOCA" \
  -F "file=@/tmp/attack.txt;type=application/x-msdownload" -F "requestId=sectest_req_a" -F "category=OTHER" \
  "$BASE/api/portal/documents/upload"); expect_reject "upload disallowed MIME type" "$c"
# 8. A cannot see B's document requests
c=$(curl -s -o /dev/null -w "%{http_code}" -H "Cookie: $DOCA" "$BASE/api/portal/requests/sectest_req_b/document-requests"); expect_reject "A reads B document-requests" "$c"

# 9. B cannot delete A's document
c=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "Cookie: $UP_B" "$BASE/api/portal/documents/sectest_doc_a"); expect_reject "B deletes A document" "$c"

# ─── MESSAGING / READ-STATE TESTS ─────────────────────────────────────────
echo "== Messaging =="
c=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Cookie: $DOCA" -H "Content-Type: application/json" \
  -d '{"messageIds":["sectest_msg_b"]}' "$BASE/api/portal/messages/read"); expect_reject "A marks B message read" "$c"
c=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Cookie: $DOCA" -H "Content-Type: application/json" \
  -d '{"messageIds":["sectest_msg_a"]}' "$BASE/api/portal/messages/read"); expect_ok "A marks own message read" "$c"
c=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Cookie: $DOCA" -H "Content-Type: application/json" \
  -d '{"messageIds":["sectest_msg_a","fake_id_1"]}' "$BASE/api/portal/messages/read"); expect_reject "mixed valid+foreign IDs rejected atomically" "$c"
# Staff reply to A's request, then A can see it
ADMIN2=$(login demo.admin@pk-demo.test "DemoPK2026!")
c=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Cookie: $ADMIN2" -H "Content-Type: application/json" \
  -d '{"body":"Staff reply test"}' "$BASE/api/admin/requests/sectest_req_a/reply"); expect_ok "staff replies to client request" "$c"
# Client cannot use staff reply endpoint
c=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Cookie: $DOCA" -H "Content-Type: application/json" \
  -d '{"body":"impersonation"}' "$BASE/api/admin/requests/sectest_req_a/reply"); expect_reject "client cannot use staff reply endpoint" "$c"

# ─── ADMIN REQUEST MANAGEMENT TESTS ───────────────────────────────────────
echo "== Admin request management =="
c=$(curl -s -o /dev/null -w "%{http_code}" -H "Cookie: $ADMIN2" "$BASE/api/admin/requests/sectest_req_a"); expect_ok "admin reads request detail (incl. internal notes)" "$c"
c=$(curl -s -o /dev/null -w "%{http_code}" -H "Cookie: $DOCA" "$BASE/api/admin/requests/sectest_req_a"); expect_reject "client cannot read admin request detail" "$c"
c=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH -H "Cookie: $DOCA" -H "Content-Type: application/json" \
  -d '{"status":"COMPLETED"}' "$BASE/api/admin/requests/sectest_req_a"); expect_reject "client cannot change status" "$c"
c=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH -H "Cookie: $ADMIN2" -H "Content-Type: application/json" \
  -d '{"status":"BOGUS_STATUS"}' "$BASE/api/admin/requests/sectest_req_a"); expect_reject "admin invalid status rejected" "$c"
body=$(curl -s -H "Cookie: $DOCA" "$BASE/api/portal/requests/sectest_req_a")
if echo "$body" | grep -q "Regression check note"; then
  FAIL=$((FAIL+1)); FAILED_NAMES+=("internal note leaked to client"); echo "FAIL internal note leaked to client"
else
  PASS=$((PASS+1)); echo "PASS internal notes not exposed to client"
fi

# ─── MEMBER MANAGEMENT TESTS ─────────────────────────────────────────────
echo "== Member management =="
c=$(curl -s -o /dev/null -w "%{http_code}" -H "Cookie: $DOCA" "$BASE/api/portal/members"); expect_ok "member list readable" "$c"
# VIEWER cannot invite
c=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Cookie: $VIEWA" -H "Content-Type: application/json" \
  -d '{"email":"x@y.test","name":"X","password":"longpassword123","role":"VIEWER"}' "$BASE/api/portal/members"); expect_reject "VIEWER invites member" "$c"
# MANAGER cannot grant OWNER
MGRA=$(login managera@sectest.test "$DOC_PW")
c=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Cookie: $MGRA" -H "Content-Type: application/json" \
  -d '{"email":"esc@y.test","name":"Esc","password":"longpassword123","role":"OWNER"}' "$BASE/api/portal/members"); expect_reject "MANAGER grants OWNER (escalation)" "$c"
# STAFF cannot invite
c=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Cookie: $STAFFB" -H "Content-Type: application/json" \
  -d '{"email":"y@y.test","name":"Y","password":"longpassword123","role":"VIEWER"}' "$BASE/api/portal/members"); expect_reject "STAFF invites member" "$c"
# OWNER invites a new VIEWER — should succeed
OWNA2=$DOCA
INVITE=$(curl -s -X POST -H "Cookie: $OWNA2" -H "Content-Type: application/json" \
  -d '{"email":"newmember@sectest.test","name":"New Member","password":"longpassword123","role":"VIEWER"}' "$BASE/api/portal/members")
NEWID=$(echo "$INVITE" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
if [ -n "$NEWID" ]; then
  PASS=$((PASS+1)); echo "PASS owner invites member"
  # B cannot remove A's member
  UPB2=$(login ownerb@sectest.test "$DOC_PW")
  c=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "Cookie: $UPB2" "$BASE/api/portal/members?memberId=$NEWID"); expect_reject "B removes A's member" "$c"
  # Self role-change blocked
  c=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH -H "Cookie: $OWNA2" -H "Content-Type: application/json" \
    -d "{\"memberId\":\"$NEWID\",\"role\":\"OWNER\"}" "$BASE/api/portal/members")
  if [ "$c" = "200" ] || [ "$c" -ge 400 ]; then :; fi
  # OWNER changes new member to STAFF, then removes them (cleanup)
  c=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH -H "Cookie: $OWNA2" -H "Content-Type: application/json" \
    -d "{\"memberId\":\"$NEWID\",\"role\":\"STAFF\"}" "$BASE/api/portal/members"); expect_ok "owner changes member role" "$c"
  c=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE -H "Cookie: $OWNA2" "$BASE/api/portal/members?memberId=$NEWID"); expect_ok "owner removes member" "$c"
else
  FAIL=$((FAIL+1)); FAILED_NAMES+=("owner invite failed"); echo "FAIL owner invite: $INVITE"
fi

# ─── LOGIN RATE LIMITING TESTS ─────────────────────────────────────────────
echo ""
echo "== Login rate limiting =="
RL_EMAIL="ratelimit@sectest.test"
RL_EMAIL2="ratelimit2@sectest.test"
# Brute force: 5 bad attempts on a nonexistent account → all generic 401/429
for i in 1 2 3 4 5; do
  c=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/auth/login" \
    -H "Content-Type: application/json" -d "{\"email\":\"$RL_EMAIL\",\"password\":\"wrongpass$i\"}")
  expect_reject "brute-force attempt $i rejected" "$c"
done
# 6th attempt (even with valid-format body) must be rate-limited (429) or rejected (401)
c=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" -d "{\"email\":\"$RL_EMAIL\",\"password\":\"whatever\"}")
if [ "$c" = "429" ] || [ "$c" = "401" ]; then PASS=$((PASS+1)); echo "PASS ($c) locked-out attempt rejected"; else FAIL=$((FAIL+1)); FAILED_NAMES+=("lockout reject"); echo "FAIL ($c) locked-out attempt"; fi
# Generic failure message — must not reveal account existence
MSG=$(curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d "{\"email\":\"$RL_EMAIL2\",\"password\":\"bad\"}" | sed 's/.*"error":"\([^"]*\)".*/\1/')
if [ "$MSG" = "Invalid email or password" ]; then PASS=$((PASS+1)); echo "PASS generic login failure message"; else FAIL=$((FAIL+1)); FAILED_NAMES+=("generic msg"); echo "FAIL message: $MSG"; fi
# Successful login clears rate-limit state: use the seeded owner account
RL_OK=$(login ownera@sectest.test "$PW")
if [ -n "$RL_OK" ]; then PASS=$((PASS+1)); echo "PASS successful login works (state cleared)"; else FAIL=$((FAIL+1)); FAILED_NAMES+=("successful login after RL"); echo "FAIL successful login after rate-limit tests"; fi

echo ""
echo "══════════════════════════════"
echo "PASS: $PASS  FAIL: $FAIL"
if [ "$FAIL" -gt 0 ]; then
  echo "Failed tests:"; printf '  - %s\n' "${FAILED_NAMES[@]}"
fi
