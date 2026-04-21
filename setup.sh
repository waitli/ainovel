#!/usr/bin/env bash
# ============================================================
# AI Novel Platform — One-Click Deployment Script
# ============================================================
# Deploys the entire ainovel platform to Cloudflare Workers.
# Usage: chmod +x setup.sh && ./setup.sh
# ============================================================
set -e

# ── Color Output ──────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

success() { echo -e "${GREEN}[✓]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
error()   { echo -e "${RED}[✗]${NC} $1"; }
info()    { echo -e "${BLUE}[i]${NC} $1"; }
step()    { echo -e "\n${CYAN}═══ Step $1: $2 ═══${NC}"; }

# ── Script Directory ──────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

STATE_FILE="$SCRIPT_DIR/.ainovel-deploy-state.json"

# ── Banner ────────────────────────────────────────────────────
echo -e "${CYAN}"
cat << 'BANNER'
    _    ___                      _
   / \  |_ _|   _ __   __ _  ___| | ___   _ _ __
  / _ \  | |   | '_ \ / _` |/ _ \ |/ / | | | '_ \
 / ___ \ | |   | | | | (_| |  __/   <| |_| | | | |
/_/   \_\___|  |_| |_|\__, |\___|_|\_\\__,_|_| |_|
                       |___/
BANNER
echo -e "${NC}"
echo "  Deploy your AI-powered collaborative novel platform"
echo "  to Cloudflare Workers in minutes."
echo ""

# ============================================================
# Step 1: Check Prerequisites
# ============================================================
step 1 "Checking prerequisites"

# Check wrangler CLI
if ! command -v wrangler &> /dev/null; then
    if command -v npx &> /dev/null; then
        info "wrangler not found globally, will use npx wrangler"
        WRANGLER="npx wrangler"
    else
        error "wrangler CLI not found. Install it with: npm install -g wrangler"
        exit 1
    fi
else
    WRANGLER="wrangler"
fi
success "wrangler CLI available"

# Check wrangler login
info "Checking Cloudflare authentication..."
if ! $WRANGLER whoami &> /dev/null; then
    warn "Not logged in to Cloudflare. Launching login flow..."
    $WRANGLER login
fi
CF_ACCOUNT=$($WRANGLER whoami 2>/dev/null | head -1 || echo "Unknown")
success "Authenticated as: $CF_ACCOUNT"

# ============================================================
# Step 2: Project Name Prefix
# ============================================================
step 2 "Project configuration"

read -p "  Project name prefix [ainovel]: " PREFIX
PREFIX="${PREFIX:-ainovel}"
info "Using prefix: ${PREFIX}"

# ============================================================
# Step 3: AI Provider Configuration
# ============================================================
step 3 "AI provider configuration"

read -p "  AI Base URL [https://openrouter.ai/api/v1/chat/completions]: " AI_BASE_URL
AI_BASE_URL="${AI_BASE_URL:-https://openrouter.ai/api/v1/chat/completions}"

read -p "  AI Model [anthropic/claude-sonnet-4-20250514]: " AI_MODEL
AI_MODEL="${AI_MODEL:-anthropic/claude-sonnet-4-20250514}"

read -s -p "  AI API Key: " AI_API_KEY
echo ""
if [ -z "$AI_API_KEY" ]; then
    error "AI API Key is required. Get one at https://openrouter.ai/keys"
    exit 1
fi
success "AI provider configured"

# ============================================================
# Step 4: JWT Secret
# ============================================================
step 4 "JWT secret"

read -p "  JWT_SECRET (leave blank to auto-generate): " JWT_SECRET
if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET=$(openssl rand -hex 32)
    success "Auto-generated JWT_SECRET: ${JWT_SECRET:0:8}..."
else
    success "Using provided JWT_SECRET"
fi

# ============================================================
# Step 5: Create Cloudflare Resources
# ============================================================
step 5 "Creating Cloudflare resources"

info "Creating D1 database..."
D1_OUTPUT=$($WRANGLER d1 create ${PREFIX}-db 2>&1) || {
    error "Failed to create D1 database"
    echo "$D1_OUTPUT"
    exit 1
}
echo "$D1_OUTPUT"
success "D1 database created"

info "Creating R2 bucket: ${PREFIX}-core..."
$WRANGLER r2 bucket create ${PREFIX}-core 2>&1 || warn "R2 bucket ${PREFIX}-core may already exist"
success "R2 bucket ${PREFIX}-core ready"

info "Creating R2 bucket: ${PREFIX}-chapters..."
$WRANGLER r2 bucket create ${PREFIX}-chapters 2>&1 || warn "R2 bucket ${PREFIX}-chapters may already exist"
success "R2 bucket ${PREFIX}-chapters ready"

info "Creating KV namespace..."
KV_OUTPUT=$($WRANGLER kv namespace create ${PREFIX}-cache 2>&1) || {
    error "Failed to create KV namespace"
    echo "$KV_OUTPUT"
    exit 1
}
echo "$KV_OUTPUT"
success "KV namespace created"

info "Creating Queue: ${PREFIX}-book-init..."
$WRANGLER queues create ${PREFIX}-book-init 2>&1 || warn "Queue ${PREFIX}-book-init may already exist"
success "Queue ${PREFIX}-book-init ready"

info "Creating Queue: ${PREFIX}-next-chapter..."
$WRANGLER queues create ${PREFIX}-next-chapter 2>&1 || warn "Queue ${PREFIX}-next-chapter may already exist"
success "Queue ${PREFIX}-next-chapter ready"

info "Creating Vectorize index..."
$WRANGLER vectorize create ${PREFIX}-vectors --dimensions=768 --metric=cosine 2>&1 || warn "Vectorize index may already exist"
success "Vectorize index ready"

# ============================================================
# Step 6: Parse Resource IDs
# ============================================================
step 6 "Parsing resource IDs"

# D1 database_id — wrangler outputs: database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
D1_DATABASE_ID=$(echo "$D1_OUTPUT" | grep -oP 'database_id\s*=\s*"\K[^"]+' | head -1)
if [ -z "$D1_DATABASE_ID" ]; then
    # Fallback: try extracting any UUID-like string
    D1_DATABASE_ID=$(echo "$D1_OUTPUT" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)
fi
if [ -z "$D1_DATABASE_ID" ]; then
    error "Could not parse D1 database_id from output above."
    error "Please enter it manually:"
    read -p "  D1 database_id: " D1_DATABASE_ID
fi
info "D1 database_id: $D1_DATABASE_ID"

# KV namespace id — wrangler outputs: id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
KV_NAMESPACE_ID=$(echo "$KV_OUTPUT" | grep -oP '\bid\s*=\s*"\K[^"]+' | head -1)
if [ -z "$KV_NAMESPACE_ID" ]; then
    KV_NAMESPACE_ID=$(echo "$KV_OUTPUT" | grep -oE '[0-9a-f]{32}' | head -1)
fi
if [ -z "$KV_NAMESPACE_ID" ]; then
    error "Could not parse KV namespace id from output above."
    error "Please enter it manually:"
    read -p "  KV namespace id: " KV_NAMESPACE_ID
fi
info "KV namespace id: $KV_NAMESPACE_ID"

# Save state
cat > "$STATE_FILE" << EOF
{
  "prefix": "$PREFIX",
  "d1_database_id": "$D1_DATABASE_ID",
  "d1_database_name": "${PREFIX}-db",
  "kv_namespace_id": "$KV_NAMESPACE_ID",
  "kv_namespace_name": "${PREFIX}-cache",
  "r2_core_bucket": "${PREFIX}-core",
  "r2_chapters_bucket": "${PREFIX}-chapters",
  "queue_name": "${PREFIX}-next-chapter",
  "queues": {
    "init_book": "${PREFIX}-book-init",
    "next_chapter": "${PREFIX}-next-chapter"
  },
  "vectorize_index": "${PREFIX}-vectors",
  "pages_project": "${PREFIX}-frontend",
  "workers": [
    "${PREFIX}-auth",
    "${PREFIX}-reading",
    "${PREFIX}-submission",
    "${PREFIX}-voting",
    "${PREFIX}-character",
    "${PREFIX}-orchestrator",
    "${PREFIX}-api"
  ],
  "ai_base_url": "$AI_BASE_URL",
  "ai_model": "$AI_MODEL",
  "deployed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
success "Resource IDs saved to .ainovel-deploy-state.json"

# ============================================================
# Step 7: Update wrangler.toml Files
# ============================================================
step 7 "Updating wrangler.toml files"

WORKERS_DIR="$SCRIPT_DIR/workers"
TOML_FILES=$(find "$WORKERS_DIR" -name "wrangler.toml" -not -path "*/queue-test/*" 2>/dev/null)

for toml in $TOML_FILES; do
    worker_dir=$(dirname "$toml")
    worker_name=$(basename "$worker_dir")
    info "Configuring worker: $worker_name"

    # Replace D1 database_id (if present)
    if grep -q 'database_id' "$toml" 2>/dev/null; then
        sed -i "s/database_id = \"[^\"]*\"/database_id = \"$D1_DATABASE_ID\"/g" "$toml"
    fi

    # Replace KV namespace id (if present)
    if grep -q '^\bid\b' "$toml" 2>/dev/null; then
        sed -i "s/^id = \"[^\"]*\"/id = \"$KV_NAMESPACE_ID\"/" "$toml"
    fi

    # Replace JWT_SECRET
    sed -i "s/JWT_SECRET=\"[^\"]*\"/JWT_SECRET=\"$JWT_SECRET\"/g" "$toml"

    # Update worker name to use prefix
    sed -i "s/^name = \"ainovel-[^\"]*\"/name = \"${PREFIX}-${worker_name}\"/" "$toml"

    # For workers with AI config, update AI_BASE_URL and AI_MODEL
    if grep -q 'AI_BASE_URL' "$toml" 2>/dev/null; then
        sed -i "s|AI_BASE_URL = \"[^\"]*\"|AI_BASE_URL = \"$AI_BASE_URL\"|g" "$toml"
    fi
    if grep -q 'AI_MODEL' "$toml" 2>/dev/null; then
        sed -i "s|AI_MODEL = \"[^\"]*\"|AI_MODEL = \"$AI_MODEL\"|g" "$toml"
    fi

    # Update R2 bucket names
    sed -i "s/bucket_name = \"ainovel-core\"/bucket_name = \"${PREFIX}-core\"/g" "$toml"
    sed -i "s/bucket_name = \"ainovel-chapters\"/bucket_name = \"${PREFIX}-chapters\"/g" "$toml"

    # Update D1 database_name
    sed -i "s/database_name = \"ainovel-db\"/database_name = \"${PREFIX}-db\"/g" "$toml"

    # Update Queue names
    sed -i "s/queue = \"ainovel-book-init\"/queue = \"${PREFIX}-book-init\"/g" "$toml"
    sed -i "s/queue = \"ainovel-next-chapter\"/queue = \"${PREFIX}-next-chapter\"/g" "$toml"
    # Backward compatibility for older config
    sed -i "s/queue = \"ainovel-chapter-generation\"/queue = \"${PREFIX}-next-chapter\"/g" "$toml"

    # Update Vectorize index name
    if grep -q 'index_name' "$toml" 2>/dev/null; then
        sed -i "s/index_name = \"ainovel-vectors\"/index_name = \"${PREFIX}-vectors\"/g" "$toml"
    fi
done
success "All wrangler.toml files updated"

# Update service bindings in API gateway
API_TOML="$WORKERS_DIR/api-gateway/wrangler.toml"
if [ -f "$API_TOML" ]; then
    info "Updating API gateway service bindings..."
    sed -i "s/service = \"ainovel-auth\"/service = \"${PREFIX}-auth\"/g" "$API_TOML"
    sed -i "s/service = \"ainovel-submission\"/service = \"${PREFIX}-submission\"/g" "$API_TOML"
    sed -i "s/service = \"ainovel-voting\"/service = \"${PREFIX}-voting\"/g" "$API_TOML"
    sed -i "s/service = \"ainovel-character\"/service = \"${PREFIX}-character\"/g" "$API_TOML"
    sed -i "s/service = \"ainovel-reading\"/service = \"${PREFIX}-reading\"/g" "$API_TOML"
    sed -i "s/service = \"ainovel-orchestrator\"/service = \"${PREFIX}-orchestrator\"/g" "$API_TOML"
    success "API gateway service bindings updated"
fi

# Update service bindings in other workers (voting, submission reference orchestrator)
for toml in $TOML_FILES; do
    if grep -q 'service = "ainovel-orchestrator"' "$toml" 2>/dev/null; then
        sed -i "s/service = \"ainovel-orchestrator\"/service = \"${PREFIX}-orchestrator\"/g" "$toml"
    fi
done

# ============================================================
# Step 8: Run D1 Schema Migration
# ============================================================
step 8 "Running D1 schema migration"

SCHEMA_FILE="$SCRIPT_DIR/schema/d1-schema.sql"
if [ ! -f "$SCHEMA_FILE" ]; then
    error "Schema file not found: $SCHEMA_FILE"
    exit 1
fi

info "Applying schema to ${PREFIX}-db (remote)..."
$WRANGLER d1 execute ${PREFIX}-db --remote --file="$SCHEMA_FILE"
success "Database schema applied"

# ============================================================
# Step 9: Set Secrets
# ============================================================
step 9 "Setting worker secrets"

# Workers that need AI_API_KEY
AI_SECRET_WORKERS=("orchestrator" "submission" "character")

for worker in "${AI_SECRET_WORKERS[@]}"; do
    TOML_PATH="$WORKERS_DIR/$worker/wrangler.toml"
    if [ -f "$TOML_PATH" ]; then
        info "Setting AI_API_KEY for ${PREFIX}-${worker}..."
        echo "$AI_API_KEY" | $WRANGLER secret put AI_API_KEY -c "$TOML_PATH"
        success "Secret set for ${PREFIX}-${worker}"
    fi
done

# ============================================================
# Step 10: Deploy Workers
# ============================================================
step 10 "Deploying workers"

DEPLOY_ORDER=("auth" "reading" "submission" "voting" "character" "orchestrator" "api-gateway")

for worker in "${DEPLOY_ORDER[@]}"; do
    TOML_PATH="$WORKERS_DIR/$worker/wrangler.toml"
    if [ -f "$TOML_PATH" ]; then
        info "Deploying ${PREFIX}-${worker}..."
        $WRANGLER deploy -c "$TOML_PATH"
        success "${PREFIX}-${worker} deployed"
    else
        warn "Worker directory not found: $worker — skipping"
    fi
done

# ============================================================
# Step 11: Build Frontend
# ============================================================
step 11 "Building frontend"

FRONTEND_DIR="$SCRIPT_DIR/frontend-web"
if [ -d "$FRONTEND_DIR" ]; then
    cd "$FRONTEND_DIR"
    info "Installing frontend dependencies..."
    npm install
    info "Building frontend..."
    npm run build
    success "Frontend built"
    cd "$SCRIPT_DIR"
else
    # Try alternate directory name
    FRONTEND_DIR="$SCRIPT_DIR/frontend"
    if [ -d "$FRONTEND_DIR" ]; then
        cd "$FRONTEND_DIR"
        info "Installing frontend dependencies..."
        npm install
        info "Building frontend..."
        npm run build
        success "Frontend built"
        cd "$SCRIPT_DIR"
    else
        error "Frontend directory not found (tried frontend-web/ and frontend/)"
        exit 1
    fi
fi

# ============================================================
# Step 12: Deploy Frontend
# ============================================================
step 12 "Deploying frontend"

DIST_DIR="$FRONTEND_DIR/dist"
if [ -d "$DIST_DIR" ]; then
    $WRANGLER pages deploy "$DIST_DIR" --project-name="${PREFIX}-frontend"
    success "Frontend deployed to Cloudflare Pages"
else
    error "Frontend dist directory not found: $DIST_DIR"
    exit 1
fi

# ============================================================
# Step 13: Print Summary
# ============================================================
step 13 "Deployment complete!"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         AI Novel Platform Deployed Successfully!        ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  Workers deployed:"
for worker in "${DEPLOY_ORDER[@]}"; do
    echo "    - ${PREFIX}-${worker}"
done
echo ""
echo "  Resources created:"
echo "    - D1 Database:    ${PREFIX}-db (${D1_DATABASE_ID})"
echo "    - R2 Buckets:     ${PREFIX}-core, ${PREFIX}-chapters"
echo "    - KV Namespace:   ${PREFIX}-cache (${KV_NAMESPACE_ID})"
echo "    - Queues:         ${PREFIX}-book-init, ${PREFIX}-next-chapter"
echo "    - Vectorize:      ${PREFIX}-vectors"
echo "    - Pages Project:  ${PREFIX}-frontend"
echo ""
echo "  URLs:"
echo "    - API Gateway:  https://${PREFIX}-api.<your-subdomain>.workers.dev"
echo "    - Frontend:     https://${PREFIX}-frontend.pages.dev"
echo ""
echo "  Next steps:"
echo "    1. Visit the frontend URL to register your first account"
echo "    2. Make yourself admin:"
echo "       wrangler d1 execute ${PREFIX}-db --remote \\"
echo "         --command=\"UPDATE users SET role='admin' WHERE email='your@email.com'\""
echo "    3. Start creating novels!"
echo ""
echo "  State file: .ainovel-deploy-state.json"
echo "  To tear down: ./cleanup.sh"
echo ""
