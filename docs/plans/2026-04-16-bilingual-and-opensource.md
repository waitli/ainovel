# Bilingual Novel Generation + One-Click Open Source Deployment

## Overview

Two parallel workstreams:
1. **Task 1**: English-first + bilingual support (UI + generation logic + data filtering)
2. **Task 2**: One-click deployment script for open-sourcing

---

## Task 1: Bilingual Novel Generation

### Design Decision: Per-Book Language (not per-user)

Language is a **book-level attribute** — each book is generated entirely in one language. When user switches the UI language toggle, they see only books matching that language. The toggle controls:
- UI chrome (labels, buttons) — i18next
- Which books are displayed — API filter
- Submission form — language-appropriate genres/placeholders
- AI generation prompts — Chinese or English prompts

**Default: English.** User can toggle to Chinese.

### Architecture

```
Frontend language toggle → localStorage('lang') → 
  1. i18next switches UI text
  2. API calls pass ?lang=en|zh filter
  3. Submission form passes language field
  4. Book list filtered by language
```

### Changes by Layer

#### Layer 1: D1 Schema — Add language column

**File**: `schema/d1-schema.sql`

Add to `books` table:
```sql
language TEXT NOT NULL DEFAULT 'zh' CHECK(language IN ('zh', 'en'))
```

Also add index:
```sql
CREATE INDEX idx_books_language ON books(language, status);
```

Migration script needed for existing DB:
```sql
ALTER TABLE books ADD COLUMN language TEXT NOT NULL DEFAULT 'zh';
CREATE INDEX idx_books_language ON books(language, status);
```

#### Layer 2: Shared Types + Constants

**File**: `shared/src/types.ts`

Add to `SubmissionData`:
```ts
language?: 'zh' | 'en';  // defaults to 'zh' for backward compat
```

Add to `Book`:
```ts
language: 'zh' | 'en';
```

**File**: `shared/src/constants.ts`

Add bilingual genre lists:
```ts
export const GENRES_ZH = ['玄幻','仙侠','科幻','都市','历史','武侠','悬疑','奇幻','言情','军事','游戏','其他'] as const;
export const GENRES_EN = ['Fantasy','Sci-Fi','Romance','Thriller','Mystery','Horror','Adventure','Historical','LitRPG','Urban','Other'] as const;

// Keep GENRES as alias for GENRES_ZH for backward compat
export const GENRES = GENRES_ZH;
```

Add English word targets:
```ts
export const CHAPTER_WORD_TARGET_ZH = { min: 2000, max: 4000 }; // Chinese chars
export const CHAPTER_WORD_TARGET_EN = { min: 1500, max: 3000 }; // English words
```

#### Layer 3: Orchestrator — Bilingual Prompts

**File**: `workers/orchestrator/src/prompt-builder.ts`

All 3 prompt functions (`buildChapterPrompt`, `buildInitPrompt`, `buildPostProcessPrompt`) accept `language: 'zh' | 'en'` parameter. Each function has two complete prompt sets.

Key prompt changes for English:
- System prompt: "You are a top web novelist..." instead of "你是一位顶级中文网络小说作家..."
- Writing frameworks translated: Snowflake Method, Character Arc Theory, Suspense Rhythm Curve (same concepts, English instructions)
- Output format: `# Chapter ${N}: [Title]` instead of `# 第${N}章 [章节标题]`
- Directions: `## What Happens Next?` with Direction A/B/C/D
- Word targets: 1500-3000 words instead of 2000-4000 chars

**File**: `workers/orchestrator/src/ai-caller.ts`

3 system prompts get English counterparts:
- `SYSTEM_PROMPT_CHAPTER_EN`: "You are a top web novelist writing in English..."
- `SYSTEM_PROMPT_ARCHITECT_EN`: "You are a world-class worldbuilding architect..."
- `SYSTEM_PROMPT_EDITOR_EN`: "You are a novel editing and analysis expert..."

Select based on `language` parameter passed through pipeline.

**File**: `workers/orchestrator/src/vector-service.ts`

Metadata labels bilingual:
- Chinese: `角色:`, `世界规则:`, `伏笔:`, `物品:`, `情节:`
- English: `Character:`, `World Rule:`, `Foreshadowing:`, `Item:`, `Plot:`

**File**: `workers/orchestrator/src/cover-generator.ts`

Already has partial English support. Enhance genre mapping.

**File**: `workers/orchestrator/src/index.ts`

- `INIT_BOOK`: Read `language` from submission data, store to D1, pass to prompts
- `GENERATE_NEXT_CHAPTER`: Read `language` from book row, pass to all generation functions
- Default direction fallback titles bilingual

#### Layer 4: Reading Worker — Language Filter

**File**: `workers/reading/src/index.ts`

`handleBookList` adds `lang` query parameter:
```ts
const lang = url.searchParams.get('lang'); // 'zh' | 'en' | null (all)
if (lang) {
  query += ` AND language = ?`;
  params.push(lang);
}
```

#### Layer 5: Submission Worker — Store Language

**File**: `workers/submission/src/index.ts`

`handleSubmit`: Read `language` from body, include in D1 INSERT:
```ts
const language = body.language || 'zh';
// INSERT includes language column
```

#### Layer 6: Content Moderator — Bilingual

**File**: `workers/submission/src/content-moderator.ts`

Pass language to moderation prompt so it checks content in the right language context.

#### Layer 7: Frontend — Complete i18n + Language Toggle

**File**: `frontend-web/src/lib/i18n.ts`

- Default to `'en'` (was `'zh'`)
- Expand translations to cover ALL UI text (currently only ~20 keys, need ~80+)
- Export helper: `getLang(): 'zh' | 'en'` from localStorage

**File**: `frontend-web/src/App.tsx`

Add language toggle button in navbar:
- Globe icon 🌐 with EN/中 label
- Saves to `localStorage('lang')`
- Changes i18next language
- Triggers re-render of book list

**File**: `frontend-web/src/lib/api.ts`

Update `getBooks()` to pass `lang` param:
```ts
getBooks(params = {}) {
  const lang = localStorage.getItem('lang') || 'en';
  return this.fetch(`/books?lang=${lang}&${qs}`);
}
```

**File**: `frontend-web/src/pages/Home.tsx`

- All hardcoded Chinese strings → `t('key')` calls
- Hero stats: "连载中" → `t('home.ongoing')`, "总章节" → `t('home.totalChapters')`, etc.
- Word count: "万" for Chinese, "k" for English
- "章" vs "chapters" suffix

**File**: `frontend-web/src/pages/Submit.tsx`

- Genre list: show `GENRES_EN` when lang=en, `GENRES_ZH` when lang=zh
- All placeholders bilingual
- Pass `language` field in submission body
- Default genre depends on language

**File**: `frontend-web/src/pages/BookDetail.tsx`

- "章" vs "Chapters" label
- All metadata bilingual

**File**: `frontend-web/src/pages/Chapter.tsx`

- "投票" vs "Vote"
- "接下来会怎样？" vs "What happens next?"
- "前情提要" vs "Previously..."
- "激进路线" vs "Bold Path" etc.

**File**: `frontend-web/src/pages/Admin.tsx`

- All labels bilingual

**File**: `frontend-web/src/pages/ApplyCharacter.tsx`

- All labels bilingual

**File**: `frontend-web/src/pages/Login.tsx`, `Register.tsx`

- All labels bilingual

### Task 1 File List (ordered by dependency)

1. `schema/d1-schema.sql` — add language column
2. `shared/src/types.ts` — add language to Book, SubmissionData
3. `shared/src/constants.ts` — add GENRES_EN, word targets
4. `workers/orchestrator/src/prompt-builder.ts` — bilingual prompts
5. `workers/orchestrator/src/ai-caller.ts` — bilingual system prompts
6. `workers/orchestrator/src/vector-service.ts` — bilingual labels
7. `workers/orchestrator/src/index.ts` — pass language through pipeline
8. `workers/submission/src/index.ts` — store language on submit
9. `workers/submission/src/content-moderator.ts` — bilingual moderation
10. `workers/reading/src/index.ts` — language filter on book list
11. `frontend-web/src/lib/i18n.ts` — full i18n, default EN
12. `frontend-web/src/lib/api.ts` — pass lang param
13. `frontend-web/src/App.tsx` — language toggle
14. `frontend-web/src/pages/Home.tsx` — all text bilingual
15. `frontend-web/src/pages/Submit.tsx` — bilingual form
16. `frontend-web/src/pages/BookDetail.tsx` — bilingual
17. `frontend-web/src/pages/Chapter.tsx` — bilingual
18. `frontend-web/src/pages/Admin.tsx` — bilingual
19. `frontend-web/src/pages/ApplyCharacter.tsx` — bilingual
20. `frontend-web/src/pages/Login.tsx`, `Register.tsx` — bilingual

---

## Task 2: One-Click Deployment for Open Source

### Design Decision: Interactive Setup Script

A single `setup.sh` script that:
1. Checks prerequisites (wrangler CLI, CF account)
2. Prompts for config (project name prefix, AI provider settings)
3. Creates all Cloudflare resources (D1, R2×2, KV, Queue, Vectorize)
4. Updates all wrangler.toml files with resource IDs
5. Runs D1 schema migration
6. Sets secrets
7. Deploys all workers in correct order
8. Builds and deploys frontend
9. Outputs final URLs

### Files to Create

#### `setup.sh` — Main deployment script

```bash
#!/bin/bash
# AI Novel Platform - One-Click Cloudflare Deployment
# Usage: bash setup.sh
```

Flow:
1. Check `wrangler` installed, user logged in
2. Prompt: project name prefix (default: "ainovel")
3. Prompt: AI provider config (base URL, model, API key)
4. Prompt: JWT secret (or generate random)
5. Create resources, capture IDs
6. Bulk-replace IDs in all wrangler.toml files
7. Run D1 migration
8. Set secrets
9. Deploy workers (order matters)
10. Build + deploy frontend
11. Print summary with all URLs

#### `setup-env.template.sh` — Non-interactive config template

For CI/CD or users who want to pre-configure:
```bash
PROJECT_PREFIX="ainovel"
AI_BASE_URL="https://api.openai.com/v1/chat/completions"
AI_MODEL="gpt-4o-mini"
AI_API_KEY="sk-..."
JWT_SECRET="random-secret-here"
```

#### `wrangler.example.toml` for each worker

Template files with placeholder IDs like `__D1_DATABASE_ID__`, `__KV_NAMESPACE_ID__`, etc. The setup script replaces these.

#### `README.md` — Updated with deployment instructions

```markdown
## Quick Start (One-Click Deploy)

1. Install wrangler: `npm i -g wrangler`
2. Login: `wrangler login`
3. Run: `bash setup.sh`
4. Follow the prompts
5. Done! Your platform is live.
```

#### `CLEANUP.md` — How to tear down

Script to delete all created resources.

### Resource Creation Commands

```bash
# D1
wrangler d1 create ${PREFIX}-db
# → database_id

# R2
wrangler r2 bucket create ${PREFIX}-core
wrangler r2 bucket create ${PREFIX}-chapters

# KV
wrangler kv namespace create ${PREFIX}-cache
# → id

# Queue
wrangler queues create ${PREFIX}-chapter-generation

# Vectorize
wrangler vectorize create ${PREFIX}-vectors --dimensions=768 --metric=cosine
```

### wrangler.toml Templating

Each worker's wrangler.toml uses named variables. Setup script does sed replacement:

```bash
# After creating resources, replace placeholders:
sed -i "s/__D1_DATABASE_ID__/${D1_ID}/g" workers/*/wrangler.toml
sed -i "s/__KV_NAMESPACE_ID__/${KV_ID}/g" workers/*/wrangler.toml
```

### Task 2 File List

1. `setup.sh` — main deployment script (interactive)
2. `setup-env.template.sh` — env template for non-interactive
3. `scripts/cleanup.sh` — teardown script
4. `scripts/replace-ids.sh` — helper for bulk ID replacement
5. `README.md` — updated with quick start + architecture docs
6. `DEPLOY.md` — detailed deployment guide (update existing)
7. `.github/workflows/deploy.yml` — optional CI/CD template
8. Update all `workers/*/wrangler.toml` to use placeholder IDs by default

---

## Execution Order

Phase 1: Task 2 first (deployment infrastructure) — makes testing Task 1 easier
Phase 2: Task 1 (bilingual support) — need to test with deployed workers

Actually, better to do Task 1 first since it changes the schema and code. Task 2 wraps everything for distribution.
