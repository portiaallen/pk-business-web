"""End-to-end test of the QB Cleanup Initial Review workflow."""
import json
import urllib.request
import urllib.error

BASE = "https://4321-3ef385af-c0a4-4694-a587-f956eb4bfc9a.daytonaproxy01.net"
REQ_ID = "cmtucijv50004fv0f9r26yy2w"  # Lucia's QB Cleanup request

passed, failed = 0, []

def check(name, ok, extra=""):
    global passed
    if ok:
        passed += 1
        print(f"PASS  {name}")
    else:
        failed.append(name)
        print(f"FAIL  {name}  {extra}")

def req(method, path, cookie=None, body=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method)
    if body is not None:
        r.add_header("Content-Type", "application/json")
    if cookie:
        r.add_header("Cookie", cookie)
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b"{}")
        except Exception:
            return e.code, {}

# ─── 1. Admin login ───
status, body = req("POST", "/api/auth/login", body={"email": "demo.admin@pk-demo.test", "password": "DemoPK2026!"})
set_cookie = None
import http.client
conn = http.client.HTTPSConnection(BASE.split("//")[1])
conn.request("POST", "/api/auth/login", json.dumps({"email": "demo.admin@pk-demo.test", "password": "DemoPK2026!"}), {"Content-Type": "application/json"})
resp = conn.getresponse()
set_cookie = (resp.getheader("Set-Cookie") or "").split(";")[0]
resp.read()
conn.close()
admin = set_cookie
check("admin login returns session", admin.startswith("pk_session="))

# ─── 2. Lucia login (client) ───
conn = http.client.HTTPSConnection(BASE.split("//")[1])
conn.request("POST", "/api/auth/login", json.dumps({"email": "elmalinowskiconsulting@gmail.com", "password": "9fIpv9wbjv_QUSbvfDUX5Je4"}), {"Content-Type": "application/json"})
resp = conn.getresponse()
lucia = (resp.getheader("Set-Cookie") or "").split(";")[0]
resp.read()
conn.close()
check("lucia login returns session", lucia.startswith("pk_session="))

# ─── 3. Start Initial Review (GET lazily creates it) ───
status, review = req("GET", f"/api/admin/requests/{REQ_ID}/qb-review", admin)
check("review loads", status == 200, str(status))
check("review has 20 categories", len(review.get("categories", [])) == 20, str(len(review.get("categories", []))))
total = review.get("progress", {}).get("totalItems", 0)
check(f"review has checklist items ({total})", total > 60, str(total))
check("progress starts near 0", review.get("progress", {}).get("completed", 99) <= 2)

# ─── 4. Lucia CANNOT access review ───
status, _ = req("GET", f"/api/admin/requests/{REQ_ID}/qb-review", lucia)
check("client blocked from review API", status >= 400, str(status))
status, _ = req("PATCH", f"/api/admin/requests/{REQ_ID}/qb-review", lucia, {"itemId": "x", "isCompleted": True})
check("client blocked from item update", status >= 400, str(status))

# ─── 5. Check items, change statuses, add notes ───
first_cat = review["categories"][0]
first_item = first_cat["items"][0]
item_id = first_item["state"]["id"]

status, _ = req("PATCH", f"/api/admin/requests/{REQ_ID}/qb-review", admin, {"itemId": item_id, "isCompleted": True, "status": "LOOKS_GOOD"})
check("check item complete + status", status == 200, str(status))

second = review["categories"][1]["items"][2]
status, updated = req("PATCH", f"/api/admin/requests/{REQ_ID}/qb-review", admin, {"itemId": second["state"]["id"], "status": "CRITICAL", "notes": "Test critical finding", "isFollowUp": True})
check("mark item CRITICAL", status == 200, str(status))

# Finding auto-created?
status, review2 = req("GET", f"/api/admin/requests/{REQ_ID}/qb-review", admin)
findings = review2.get("findings", [])
check("finding auto-created from CRITICAL item", any(f.get("checklistItemId") == second["state"]["id"] for f in findings), str(len(findings)))

# Un-flag → finding removed
status, _ = req("PATCH", f"/api/admin/requests/{REQ_ID}/qb-review", admin, {"itemId": second["state"]["id"], "status": "REVIEWED", "notes": ""})
status, review3 = req("GET", f"/api/admin/requests/{REQ_ID}/qb-review", admin)
check("finding removed when un-flagged", not any(f.get("checklistItemId") == second["state"]["id"] for f in review3.get("findings", [])))

# ─── 6. Filters/search operate on real data ───
completed_count = review2["progress"]["completed"]
check("progress persisted after item check", completed_count >= 1, str(completed_count))

# ─── 7. Client question ───
status, q = req("POST", f"/api/admin/requests/{REQ_ID}/qb-review", admin, {"type": "question", "question": "TEST: Which credit card was used for business expenses?"})
check("create client question", status == 201, str(status))
q_id = q.get("id")
status, _ = req("PATCH", f"/api/admin/requests/{REQ_ID}/qb-review", admin, {"questionId": q_id, "status": "SENT", "internalNotes": "sent to Lucia"})
check("update question status", status == 200, str(status))

# ─── 8. Doc log ───
status, d = req("POST", f"/api/admin/requests/{REQ_ID}/qb-review", admin, {"type": "docLog", "name": "TEST: Balance Sheet as of 12/31/2025", "docType": "BALANCE_SHEET", "dateOrPeriod": "FY2025"})
check("create doc log", status == 201, str(status))
d_id = d.get("id")

# ─── 9. Review notes ───
status, _ = req("PATCH", f"/api/admin/requests/{REQ_ID}/qb-review", admin, {"notes": "Initial review in progress — test note."})
check("save review notes", status == 200, str(status))

# ─── 10. Persistence across reload ───
status, review4 = req("GET", f"/api/admin/requests/{REQ_ID}/qb-review", admin)
check("notes persist", "test note" in review4.get("notes", ""), review4.get("notes", "")[:60])
check("question persists", any(qq.get("id") == q_id for qq in review4.get("questions", [])))
check("doc log persists", any(dd.get("id") == d_id for dd in review4.get("docLogs", [])))
item_states = {i["state"]["id"]: i["state"] for c in review4["categories"] for i in c["items"]}
check("item completion persists", item_states.get(item_id, {}).get("isCompleted") is True)
check("item status persists", item_states.get(item_id, {}).get("status") == "LOOKS_GOOD")

# ─── 11. Cleanup test artifacts ───
req("DELETE", f"/api/admin/requests/{REQ_ID}/qb-review?questionId={q_id}", admin)
req("DELETE", f"/api/admin/requests/{REQ_ID}/qb-review?docLogId={d_id}", admin)
req("PATCH", f"/api/admin/requests/{REQ_ID}/qb-review", admin, {"itemId": item_id, "isCompleted": False, "status": "NOT_REVIEWED", "notes": ""})
req("PATCH", f"/api/admin/requests/{REQ_ID}/qb-review", admin, {"notes": ""})
status, review5 = req("GET", f"/api/admin/requests/{REQ_ID}/qb-review", admin)
check("cleanup artifacts removed", len(review5.get("questions", [])) == 0 and len(review5.get("docLogs", [])) == 0)

# ─── 12. Existing functionality still works ───
status, _ = req("GET", "/api/admin/requests", admin)
check("existing admin requests API works", status == 200, str(status))
status, _ = req("GET", f"/api/admin/requests/{REQ_ID}", admin)
check("existing request detail API works", status == 200, str(status))
status, _ = req("GET", "/api/admin/clients", admin)
check("existing clients API works", status == 200, str(status))

print()
print(f"{'='*50}")
print(f"RESULT: {passed} passed, {len(failed)} failed")
if failed:
    print("Failed:", failed)
    raise SystemExit(1)
