#!/usr/bin/env bash
# ============================================================
# AI Novel Platform — Cleanup / Teardown Script
# ============================================================
# Deletes all Cloudflare resources created by setup.sh.
# Usage: chmod +x cleanup.sh && ./cleanup.sh
# ============================================================
set -e

# ── Color Output ──────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

success() { echo -e "${GREEN}[✓]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
error()   { echo -e "${RED}[✗]${NC} $1"; }
info()    { echo -e "${BLUE}[i]${NC} $1"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_FILE="$SCRIPT_DIR/.ainovel-deploy-state.json"

# ── Banner ────────────────────────────────────────────────────
echo -e "${RED}"
cat << 'BANNER'
    _    ___               _         _
   / \  |_ _|  _ __   ___ | |_   ___| | __
  / _ \  | |  | '_ \ / _ \| __| / __| |/ /
 / ___ \ | |  | | | | (_) | |_  \__ \   <
/_/   \_\___| |_| |_|\___/ \__| |___/_|\_\

BANNER
echo -e "${NC}"
echo "  This will delete ALL Cloudflare resources"
echo "  created by the setup.sh script."
echo ""

# ── Check wrangler ────────────────────────────────────────────
if ! command -v wrangler &> /dev/null; then
    if command -v npx &> /dev/null; then
        WRANGLER="npx wrangler"
    else
        error "wrangler CLI not found. Install it with: npm install -g wrangler"
        exit 1
    fi
else
    WRANGLER="wrangler"
fi

# ── Load State ────────────────────────────────────────────────
if [ ! -f "$STATE_FILE" ]; then
    error "State file not found: $STATE_FILE"
    echo "  Either setup.sh was never run, or the state file was deleted."
    echo ""
    echo "  To manually clean up, specify the prefix:"
    read -p "  Project prefix (or 'q' to quit): " PREFIX
    if [ "$PREFIX" = "q" ] || [ -z "$PREFIX" ]; then
        exit 0
    fi
    # Manual mode — just ask for what we need
    D1_DATABASE_NAME="${PREFIX}-db"
    KV_NAMESPACE_NAME="${PREFIX}-cache"
    R2_CORE_BUCKET="${PREFIX}-core"
    R2_CHAPTERS_BUCKET="${PREFIX}-chapters"
    INIT_QUEUE_NAME="${PREFIX}-book-init"
    NEXT_QUEUE_NAME="${PREFIX}-next-chapter"
    VECTORIZE_INDEX="${PREFIX}-vectors"
    PAGES_PROJECT="${PREFIX}-frontend"
    WORKERS=("${PREFIX}-auth" "${PREFIX}-reading" "${PREFIX}-submission" "${PREFIX}-voting" "${PREFIX}-character" "${PREFIX}-orchestrator" "${PREFIX}-api")
else
    # Parse state file
    PREFIX=$(python3 -c "import json; print(json.load(open('$STATE_FILE'))['prefix'])" 2>/dev/null || echo "")
    D1_DATABASE_NAME=$(python3 -c "import json; print(json.load(open('$STATE_FILE'))['d1_database_name'])" 2>/dev/null || echo "${PREFIX}-db")
    KV_NAMESPACE_NAME=$(python3 -c "import json; print(json.load(open('$STATE_FILE'))['kv_namespace_name'])" 2>/dev/null || echo "${PREFIX}-cache")
    R2_CORE_BUCKET=$(python3 -c "import json; print(json.load(open('$STATE_FILE'))['r2_core_bucket'])" 2>/dev/null || echo "${PREFIX}-core")
    R2_CHAPTERS_BUCKET=$(python3 -c "import json; print(json.load(open('$STATE_FILE'))['r2_chapters_bucket'])" 2>/dev/null || echo "${PREFIX}-chapters")
    INIT_QUEUE_NAME=$(python3 -c "import json; d=json.load(open('$STATE_FILE')); print(d.get('queues', {}).get('init_book', f\"{d.get('prefix','ainovel')}-book-init\"))" 2>/dev/null || echo "${PREFIX}-book-init")
    NEXT_QUEUE_NAME=$(python3 -c "import json; d=json.load(open('$STATE_FILE')); print(d.get('queues', {}).get('next_chapter', d.get('queue_name', f\"{d.get('prefix','ainovel')}-next-chapter\")))" 2>/dev/null || echo "${PREFIX}-next-chapter")
    VECTORIZE_INDEX=$(python3 -c "import json; print(json.load(open('$STATE_FILE'))['vectorize_index'])" 2>/dev/null || echo "${PREFIX}-vectors")
    PAGES_PROJECT=$(python3 -c "import json; print(json.load(open('$STATE_FILE'))['pages_project'])" 2>/dev/null || echo "${PREFIX}-frontend")

    # Read workers list
    mapfile -t WORKERS < <(python3 -c "
import json
data = json.load(open('$STATE_FILE'))
for w in data.get('workers', []):
    print(w)
" 2>/dev/null)
fi

if [ -z "$PREFIX" ]; then
    error "Could not determine project prefix."
    exit 1
fi

# ── Show What Will Be Deleted ─────────────────────────────────
echo "  The following resources will be deleted:"
echo ""
echo "    Workers:"
for w in "${WORKERS[@]}"; do
    echo "      - $w"
done
echo ""
echo "    D1 Database:     $D1_DATABASE_NAME"
echo "    R2 Buckets:      $R2_CORE_BUCKET, $R2_CHAPTERS_BUCKET"
echo "    KV Namespace:    $KV_NAMESPACE_NAME"
echo "    Queues:          $INIT_QUEUE_NAME, $NEXT_QUEUE_NAME"
echo "    Vectorize Index: $VECTORIZE_INDEX"
echo "    Pages Project:   $PAGES_PROJECT"
echo ""

# ── Confirm ───────────────────────────────────────────────────
read -p "$(echo -e "${RED}  Are you sure? This cannot be undone. (yes/no): ${NC}")" CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "  Aborted."
    exit 0
fi

echo ""
info "Starting cleanup..."
echo ""

# ── Delete Workers ────────────────────────────────────────────
WORKERS_DIR="$SCRIPT_DIR/workers"
for worker in "${WORKERS[@]}"; do
    # Find the matching local directory
    local_dir=""
    case "$worker" in
        *-auth)         local_dir="auth" ;;
        *-reading)      local_dir="reading" ;;
        *-submission)   local_dir="submission" ;;
        *-voting)       local_dir="voting" ;;
        *-character)    local_dir="character" ;;
        *-orchestrator) local_dir="orchestrator" ;;
        *-api)          local_dir="api-gateway" ;;
    esac

    TOML_PATH="$WORKERS_DIR/$local_dir/wrangler.toml"
    if [ -f "$TOML_PATH" ]; then
        info "Deleting worker: $worker"
        $WRANGLER delete -c "$TOML_PATH" 2>&1 || warn "Could not delete $worker (may not exist)"
    else
        # Try deleting by name without local toml
        info "Deleting worker: $worker (by name)"
        $WRANGLER delete --name "$worker" 2>&1 || warn "Could not delete $worker"
    fi
done
success "Workers deleted"

# ── Delete D1 Database ────────────────────────────────────────
info "Deleting D1 database: $D1_DATABASE_NAME"
$WRANGLER d1 delete "$D1_DATABASE_NAME" --force 2>&1 || warn "Could not delete D1 database (may not exist)"
success "D1 database deleted"

# ── Delete R2 Buckets ─────────────────────────────────────────
info "Deleting R2 bucket: $R2_CORE_BUCKET"
$WRANGLER r2 bucket delete "$R2_CORE_BUCKET" 2>&1 || warn "Could not delete R2 bucket (may not exist)"

info "Deleting R2 bucket: $R2_CHAPTERS_BUCKET"
$WRANGLER r2 bucket delete "$R2_CHAPTERS_BUCKET" 2>&1 || warn "Could not delete R2 bucket (may not exist)"
success "R2 buckets deleted"

# ── Delete KV Namespace ───────────────────────────────────────
info "Deleting KV namespace: $KV_NAMESPACE_NAME"
$WRANGLER kv namespace delete --namespace-id="$KV_NAMESPACE_NAME" 2>&1 || {
    # Try by binding name
    $WRANGLER kv namespace delete --binding="$KV_NAMESPACE_NAME" 2>&1 || warn "Could not delete KV namespace (may not exist)"
}
success "KV namespace deleted"

# ── Delete Queues ─────────────────────────────────────────────
info "Deleting Queue: $INIT_QUEUE_NAME"
$WRANGLER queues delete "$INIT_QUEUE_NAME" 2>&1 || warn "Could not delete Queue (may not exist)"

info "Deleting Queue: $NEXT_QUEUE_NAME"
$WRANGLER queues delete "$NEXT_QUEUE_NAME" 2>&1 || warn "Could not delete Queue (may not exist)"
success "Queues deleted"

# ── Delete Vectorize Index ────────────────────────────────────
info "Deleting Vectorize index: $VECTORIZE_INDEX"
$WRANGLER vectorize delete "$VECTORIZE_INDEX" 2>&1 || warn "Could not delete Vectorize index (may not exist)"
success "Vectorize index deleted"

# ── Delete Pages Project ──────────────────────────────────────
info "Deleting Pages project: $PAGES_PROJECT"
$WRANGLER pages project delete "$PAGES_PROJECT" 2>&1 || warn "Could not delete Pages project (may not exist)"
success "Pages project deleted"

# ── Remove State File ─────────────────────────────────────────
if [ -f "$STATE_FILE" ]; then
    rm "$STATE_FILE"
    info "Removed state file: $STATE_FILE"
fi

echo ""
success "All resources cleaned up!"
echo ""
echo "  If any resources failed to delete, you can remove them"
echo "  manually via the Cloudflare Dashboard."
echo ""
