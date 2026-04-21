#!/bin/bash
# 批量初始化小说 — 使用 curl + proxy
# 每本间隔 30s，AI限速时等 90s

set -e
cd /home/halcyon/ainovel
export HTTP_PROXY=http://172.20.224.1:8080
export HTTPS_PROXY=http://172.20.224.1:8080

API="https://api.ainovel.waitli.top/api/v1"
ORCH="https://ainovel-orchestrator.waitli.workers.dev/init-book"

# Login
TOKEN=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"n1776325916530@ink.com","password":"create2026"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")
echo "Login OK. Token: ${TOKEN:0:20}..."

# Get approved books
BOOKS=$(curl -s "$API/submissions?status=approved&limit=100" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "
import sys,json
d = json.load(sys.stdin)
books = d['data']['books']
for b in books:
    sub = b['submission_data'] if isinstance(b['submission_data'], dict) else json.loads(b['submission_data'])
    lang = sub.get('language','zh')
    print(f'{b[\"id\"]}|{b[\"title\"]}|{lang}')
")

COUNT=$(echo "$BOOKS" | wc -l)
echo "Found $COUNT approved books to initialize"
echo ""

I=0
echo "$BOOKS" | while IFS='|' read -r BOOK_ID TITLE LANG; do
  I=$((I+1))
  echo -n "[$I/$COUNT] $TITLE [$LANG] ... "

  # Get submission data
  SUB_DATA=$(curl -s "$API/submissions/$BOOK_ID" \
    -H "Authorization: Bearer $TOKEN" \
    | python3 -c "
import sys,json
d = json.load(sys.stdin)
b = d['data']
sub = b['submission_data'] if isinstance(b['submission_data'], dict) else json.loads(b['submission_data'])
print(json.dumps({'type':'INIT_BOOK','book_id':'$BOOK_ID','submission':sub}))
")

  # Call orchestrator
  RESULT=$(curl -s -X POST "$ORCH" \
    -H "Content-Type: application/json" \
    -d "$SUB_DATA" 2>&1)

  SUCCESS=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print('ok' if d.get('success') else d.get('error','unknown')[:80])" 2>/dev/null || echo "parse_error")

  if [ "$SUCCESS" = "ok" ]; then
    echo "✓"
  elif echo "$SUCCESS" | grep -q "429\|cooldown"; then
    echo "⏳ 限速 等90s..."
    sleep 90
    RESULT2=$(curl -s -X POST "$ORCH" \
      -H "Content-Type: application/json" \
      -d "$SUB_DATA" 2>&1)
    OK2=$(echo "$RESULT2" | python3 -c "import sys,json; print('ok' if json.load(sys.stdin).get('success') else 'fail')" 2>/dev/null || echo "fail")
    echo "  $([ \"$OK2\" = \"ok\" ] && echo '✓ 重试' || echo '✗ 失败')"
  elif echo "$SUCCESS" | grep -q "UNIQUE"; then
    echo "⊘ 已有"
  else
    echo "✗ ${SUCCESS:0:60}"
  fi

  if [ "$I" -lt "$COUNT" ]; then
    echo -n "  等30s..."
    sleep 30
    echo " OK"
  fi
done

echo ""
echo "=== 最终统计 ==="
ACTIVE=$(curl -s "$API/books?status=active&limit=100" -H "Authorization: Bearer $TOKEN")
echo "$ACTIVE" | python3 -c "
import sys,json
d = json.load(sys.stdin)
books = d['data']['books']
zh = [b for b in books if b.get('language')=='zh']
en = [b for b in books if b.get('language')=='en']
print(f'中文: {len(zh)} 本 | English: {len(en)} books | Total: {len(books)}')
"
echo "✅ 全部完成"
