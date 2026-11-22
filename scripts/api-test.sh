#!/usr/bin/env bash
# End-to-end API smoke test. Starts nothing: point BASE_URL at a running server with a fresh DATA_DIR.
#   BASE_URL=http://localhost:3100 SAMPLE_XLSX=/path/log.xlsx scripts/api-test.sh
set -uo pipefail
BASE_URL="${BASE_URL:-http://localhost:3000}"
SAMPLE_XLSX="${SAMPLE_XLSX:-}"
JAR="$(mktemp)"
FAILS=0
pass() { echo "  ok   $1"; }
fail() { echo "  FAIL $1"; FAILS=$((FAILS+1)); }
jq_() { python3 -c "import sys,json; d=json.load(sys.stdin); print(eval(sys.argv[1]))" "$1"; }
# req METHOD PATH [data] -> sets BODY, CODE
req() {
  local m="$1" p="$2" d="${3:-}"
  local args=(-s -o /tmp/hk_body -w '%{http_code}' -X "$m" -b "$JAR" -c "$JAR" "$BASE_URL$p")
  [ -n "${TOKEN:-}" ] && args+=(-H "Authorization: Bearer $TOKEN")
  [ -n "$d" ] && args+=(-H 'Content-Type: application/json' -d "$d")
  CODE=$(curl "${args[@]}"); BODY=$(cat /tmp/hk_body)
}
expect() { # expect CODE description [python-expr]
  if [ "$CODE" != "$1" ]; then fail "$2 (HTTP $CODE, wanted $1): $BODY"; return; fi
  if [ -n "${3:-}" ] && ! echo "$BODY" | jq_ "$3" | grep -qx True; then fail "$2 (assertion '$3' failed): ${BODY:0:300}"; return; fi
  pass "$2"
}

echo "health / openapi"
req GET /api/health; expect 200 "health" "d['ok'] is True"
req GET /api/openapi.json; expect 200 "openapi.json" "d['openapi']=='3.1.0' and len(d['paths'])>20"
curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/docs" | grep -q 200 && pass "/docs" || fail "/docs"
req GET /api/v1/me; expect 401 "unauthenticated /me is 401"

echo "auth"
U="tester$RANDOM"
req POST /api/auth/signup "{\"username\":\"$U\",\"password\":\"correct horse 1\",\"displayName\":\"Alex\"}"
if [ "$CODE" = 403 ]; then req POST /api/auth/login "{\"username\":\"$U\",\"password\":\"x\"}"; echo "  (signup closed; set ALLOW_SIGNUP=true or use a fresh DATA_DIR)"; exit 1; fi
expect 201 "signup" "d['user']['username']=='$U'"
echo "$BODY" | grep -qi hash && fail "signup leaks hash" || pass "no hash in response"
req GET /api/v1/me; expect 200 "me via cookie" "bool(d['person']['name'])"
req POST /api/auth/logout; expect 200 "logout"
req GET /api/v1/me; expect 401 "me after logout is 401"
req POST /api/auth/login "{\"username\":\"$U\",\"password\":\"wrong\"}"; expect 401 "bad login"
req POST /api/auth/login "{\"username\":\"$U\",\"password\":\"correct horse 1\"}"; expect 200 "login"

echo "tokens"
req POST /api/v1/tokens '{"name":"test"}'; expect 201 "create token" "d['token'].startswith('hk_')"
TOKEN=$(echo "$BODY" | jq_ "d['token']"); TOKEN_ID=$(echo "$BODY" | jq_ "d['id']")
rm -f "$JAR"; JAR="$(mktemp)"   # from here on: bearer only
req GET /api/v1/tokens; expect 200 "list tokens" "len(d['tokens'])==1 and 'token' not in d['tokens'][0] and 'tokenHash' not in d['tokens'][0]"

echo "hikes"
req POST /api/v1/hikes '{"date":"2026-01-17","endDate":"2026-01-18","peaks":["Mount Lafayette","Lincoln","Not A Real Peak"],"participants":["Sam",{"person":"Jordan","counts":false}],"conditions":"snow","externalId":"test-1"}'
expect 201 "POST hike by names" "len(d['hike']['peaks'])==2 and d['hike']['isWinter'] and d['hike']['unmatchedPeaks']==['Not A Real Peak']"
HID=$(echo "$BODY" | jq_ "d['hike']['id']")
req POST /api/v1/hikes '{"date":"2026-01-17","endDate":"2026-01-18","peaks":["Lafayette","Lincoln"],"externalId":"test-1"}'
expect 200 "idempotent re-post updates" "d['hike']['id']==$HID and not d['created']"
req PATCH /api/v1/hikes/$HID '{"notes":"great day","participants":["Alex","Sam"]}'
expect 200 "PATCH merges" "d['hike']['notes']=='great day' and len(d['hike']['peaks'])==2 and len(d['hike']['participants'])==2"
req GET "/api/v1/hikes?peak=lafayette&limit=5"; expect 200 "list hikes filtered" "d['total']==1"
req GET "/api/v1/hikes?person=Sam&list=nh-48"; expect 200 "list hikes by person+list" "d['total']==1"
req POST /api/v1/hikes '{"date":"2026-13-45"}'; expect 400 "bad date -> 400" "'issues' in d['details']"
req POST /api/v1/hikes '{"date":"2026-02-01","peaks":["Zzzz"],"strictPeaks":true}'; expect 422 "strictPeaks -> 422"
req GET /api/v1/hikes/999999; expect 404 "missing hike 404"

echo "peaks / lists"
req POST /api/v1/peaks/match '{"names":"Washington, Wildcat A, Owls Head"}'; expect 200 "match" "len(d['results'])==3"
req GET "/api/v1/peaks?q=lafay"; expect 200 "peak search" "d['peaks'][0]['slug']=='mount-lafayette' or 'lafayette' in d['peaks'][0]['slug']"
req GET /api/v1/peaks/lafayette; expect 200 "peak detail" "len(d['ascents'])>=2 and len(d['lists'])>=1"
req GET /api/v1/lists; expect 200 "lists" "len(d['lists'])>5 and isinstance(d['lists'][0]['sources'], list)"
req GET /api/v1/lists/nh-48; expect 200 "list detail" "len(d['peaks'])==48"

echo "progress / compare"
req GET "/api/v1/lists/nh-48/progress?mode=winter"; expect 200 "list progress (me, winter)" "d['completed']==2 and d['total']==48"
req GET "/api/v1/lists/nh-48/progress?mode=bogus"; expect 400 "bad mode"
req GET "/api/v1/progress?person=Sam"; expect 200 "all progress" "any(l['completed']==2 for l in d['lists'])"
req GET "/api/v1/compare?list=nh-48&people=Alex,Sam&mode=all"; expect 200 "compare" "d['summary']['allDone']==2 and len(d['people'])==2"

echo "people"
req POST /api/v1/people '{"name":"Riley","color":"#3a7d44"}'; expect 201 "create person"
ANNA=$(echo "$BODY" | jq_ "d['person']['id']")
req POST /api/v1/people '{"name":"anna"}'; expect 409 "duplicate name 409"
req PATCH /api/v1/people/$ANNA '{"name":"Riley B"}'; expect 200 "rename"
req GET /api/v1/people; expect 200 "list people" "any(p['name']=='Sam' and p['hikeCount']==1 for p in d['people'])"
req POST /api/v1/people '{"name":"Jordan S"}'; HS=$(echo "$BODY" | jq_ "d['person']['id']")
req POST /api/v1/people/$HS/merge '{"into":"Jordan"}'; expect 200 "merge" "d['person']['name']=='Jordan'"
ME=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/v1/me" | jq_ "d['person']['id']")
req DELETE /api/v1/people/$ME; expect 409 "cannot delete linked person"
req DELETE /api/v1/people/$ANNA; expect 200 "delete unlinked person"

echo "users"
req GET /api/v1/users; expect 200 "admin list users" "'passwordHash' not in str(d) and 'password_hash' not in str(d)"
req POST /api/v1/users '{"username":"sam","password":"another pass 22","displayName":"Sam"}'; expect 201 "admin create user (links existing person)"
req PATCH /api/v1/users/1 '{"isAdmin":false}'; expect 409 "cannot drop last admin"

if [ -n "$SAMPLE_XLSX" ] && [ -f "$SAMPLE_XLSX" ]; then
  echo "import"
  CODE=$(curl -s -o /tmp/hk_body -w '%{http_code}' -H "Authorization: Bearer $TOKEN" -F "file=@$SAMPLE_XLSX" "$BASE_URL/api/v1/import/xlsx?dryRun=1"); BODY=$(cat /tmp/hk_body)
  expect 200 "import dry run" "d['dryRun'] and d['summary']['rows']>40 and d['logSheet']=='Log'"
  echo "$BODY" | jq_ "'      summary: '+str(d['summary']['create'])+' create, '+str(d['summary']['update'])+' update, '+str(d['summary']['skipped'])+' skipped, unmatched='+str(d['summary']['unmatchedPeaks'])+' newPeople='+str(d['summary']['newPeople'])"
  echo "$BODY" | jq_ "'      reconcile: '+str([(r['sheet'],r['mode'],len(r['sheetOnly']),len(r['logOnly'])) for r in d['reconcile']])"
  req GET "/api/v1/hikes?limit=1"; BEFORE=$(echo "$BODY" | jq_ "d['total']")
  [ "$BEFORE" = 1 ] && pass "dry run wrote nothing" || fail "dry run wrote rows ($BEFORE)"
  CODE=$(curl -s -o /tmp/hk_body -w '%{http_code}' -H "Authorization: Bearer $TOKEN" -F "file=@$SAMPLE_XLSX" -F "self=Alex" "$BASE_URL/api/v1/import/xlsx"); BODY=$(cat /tmp/hk_body)
  expect 200 "import commit" "d['created']>40"
  CODE=$(curl -s -o /tmp/hk_body -w '%{http_code}' -H "Authorization: Bearer $TOKEN" -F "file=@$SAMPLE_XLSX" -F "self=Alex" "$BASE_URL/api/v1/import/xlsx"); BODY=$(cat /tmp/hk_body)
  expect 200 "re-import is idempotent" "d['created']==0 and d['updated']>40"
fi

req DELETE /api/v1/hikes/$HID; expect 200 "delete hike"
req DELETE /api/v1/tokens/$TOKEN_ID; expect 200 "revoke token"
req GET /api/v1/me; expect 401 "revoked token rejected"

echo
[ "$FAILS" = 0 ] && echo "ALL PASSED" || { echo "$FAILS FAILED"; exit 1; }
