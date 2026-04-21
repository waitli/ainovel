# AI Novel Platform (ainovel)

A collaborative AI-powered novel writing platform where readers vote on plot directions and AI generates the next chapters. Built entirely on Cloudflare Workers.

## What It Does

Readers submit novel ideas. Admins approve them. AI generates the first chapter and 2-4 plot direction options. Readers vote on what happens next. When enough votes are cast, AI generates the next chapter based on the winning direction. The cycle repeats, creating a collaborative, reader-driven novel.

Key features:
- **Reader submissions** — anyone can pitch a novel idea
- **AI chapter generation** — chapters written by LLM with full context (worldbuilding, plot, characters, recent chapters)
- **Democratic voting** — readers choose the plot direction
- **Character applications** — readers can request their character appear in a story
- **Admin moderation** — submissions and character applications go through approval

## Architecture

```
+------------------------------------------------------------------+
|                          USER LAYER                              |
|   Reader / Admin / Guest                                          |
+------------------------------------------------------------------+
           |                  |                  |
           v                  v                  v
+-------------------+ +------------------+ +---------------------+
| Cloudflare Pages  | |  API Gateway     | |  Mobile (Expo)      |
| (React Frontend)  | |  Worker          | |  (future)           |
+-------------------+ +------------------+ +---------------------+
                           |  service bindings
           +---------------+------------------+
           |          |          |         |          |
           v          v          v         v          v
     +----------+ +----------+ +------+ +--------+ +-----------+
     |   Auth   | | Reading  | | Sub- | | Voting | | Character |
     |  Worker  | |  Worker  | | mit  | | Worker | |  Worker   |
     +----------+ +----------+ +------+ +--------+ +-----------+
           |          |          |         |
           +----------+----------+---------+----------+
                        |          |                   |
                        v          v                   v
                  +----------+ +--------+       +-------------+
                  |  Queue   | |  D1    |       | Orchestrator|
                  | (chapter | | (SQL)  |       |   Worker    |
                  |  gen)    | +--------+       +-------------+
                  +----------+      |            |    |    |
                               +----+       +----+  +----+ +------+
                               |            |         |        |
                               v            v         v        v
                          +--------+  +---------+ +------+ +--------+
                          |  KV    |  | R2 Core | |R2 Ch.| |Vector- |
                          |(cache) |  |(files)  | |(files)| |  ize   |
                          +--------+  +---------+ +------+ +--------+
```

## One-Click Deploy

### Prerequisites

- Node.js >= 20
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/): `npm install -g wrangler`
- Cloudflare account (free tier works)
- AI API key ([OpenRouter](https://openrouter.ai/keys) or any OpenAI-compatible provider)

### Deploy

```bash
git clone https://github.com/<your-org>/ainovel.git
cd ainovel
chmod +x setup.sh
./setup.sh
```

The script will:
1. Check prerequisites and Cloudflare login
2. Prompt for project name, AI provider config, and JWT secret
3. Create all Cloudflare resources (D1, R2, KV, Queue, Vectorize)
4. Update all config files automatically
5. Run database migrations
6. Set API secrets
7. Deploy all workers in the correct order
8. Build and deploy the frontend
9. Print all URLs and next steps

### Tear Down

```bash
./cleanup.sh
```

Deletes all Cloudflare resources created by `setup.sh`. Prompts for confirmation.

## Manual Deploy

If you prefer to deploy step by step, see [DEPLOY.md](./DEPLOY.md) for detailed instructions.

Quick summary:

```bash
# 1. Install dependencies
pnpm install

# 2. Create Cloudflare resources
wrangler d1 create ainovel-db
wrangler r2 bucket create ainovel-core
wrangler r2 bucket create ainovel-chapters
wrangler kv namespace create ainovel-cache
wrangler queues create ainovel-book-init
wrangler queues create ainovel-next-chapter
wrangler vectorize create ainovel-vectors --dimensions=768 --metric=cosine

# 3. Update workers/*/wrangler.toml with resource IDs

# 4. Run database migration
wrangler d1 execute ainovel-db --remote --file=schema/d1-schema.sql

# 5. Set secrets
echo "YOUR_API_KEY" | wrangler secret put AI_API_KEY -c workers/orchestrator/wrangler.toml
echo "YOUR_API_KEY" | wrangler secret put AI_API_KEY -c workers/submission/wrangler.toml
echo "YOUR_API_KEY" | wrangler secret put AI_API_KEY -c workers/character/wrangler.toml
# Optional (recommended): separate key for cover image generation
echo "YOUR_DOUBAO_IMAGE_KEY" | wrangler secret put COVER_API_KEY -c workers/orchestrator/wrangler.toml

# 6. Deploy workers (order matters)
cd workers/auth && wrangler deploy
cd ../reading && wrangler deploy
cd ../submission && wrangler deploy
cd ../voting && wrangler deploy
cd ../character && wrangler deploy
cd ../orchestrator && wrangler deploy
cd ../api-gateway && wrangler deploy

# 7. Build and deploy frontend
cd frontend-web && npm install && npm run build
wrangler pages deploy dist --project-name=ainovel-frontend
```

## Project Structure

```
ainovel/
|-- setup.sh                    # One-click deploy script
|-- cleanup.sh                  # Teardown script
|-- schema/
|   |-- d1-schema.sql           # Database schema (6 tables)
|-- shared/                     # Shared types and utilities
|-- workers/
|   |-- auth/                   # Authentication (JWT, register, login)
|   |-- reading/                # Book/chapter reading API
|   |-- submission/             # Novel submission and admin approval
|   |-- voting/                 # Direction voting (Durable Objects)
|   |-- character/              # Character application and approval
|   |-- orchestrator/           # AI chapter generation, queue consumer
|   |-- api-gateway/            # Unified API entry point (service bindings)
|-- frontend-web/               # React + Vite frontend
|   |-- src/
|       |-- pages/              # Home, BookDetail, Chapter, Login, Register, etc.
|       |-- lib/                # API client, i18n
|-- docs/                       # Additional documentation
```

## Environment Variables

These are configured automatically by `setup.sh`, or manually in each worker's `wrangler.toml`:

| Variable | Description | Used By | Example |
|----------|-------------|---------|---------|
| `JWT_SECRET` | JWT signing secret (64-char hex) | auth, api-gateway, reading, submission, voting, character, orchestrator | `a3f1...c9d2` |
| `AI_API_KEY` | AI provider API key (secret) | orchestrator, submission, character | `sk-or-v1-...` |
| `AI_MODEL` | Model identifier | orchestrator, submission, character | `anthropic/claude-sonnet-4-20250514` |
| `AI_BASE_URL` | OpenAI-compatible API endpoint | orchestrator, submission, character | `https://openrouter.ai/api/v1/chat/completions` |
| `COVER_API_KEY` | (Optional) dedicated key for cover image API (secret); falls back to `AI_API_KEY` when unset | orchestrator | `xxxxxxxx` |
| `COVER_BASE_URL` | Cover image generation endpoint | orchestrator | `https://ark.cn-beijing.volces.com/api/v3/images/generations` |
| `COVER_MODEL` | Cover image model | orchestrator | `doubao-seedream-4-5-251128` |
| `COVER_SIZE` | Cover image size | orchestrator | `2K` |
| `COVER_WATERMARK` | Whether to add provider watermark | orchestrator | `true` |
| `COVER_RESPONSE_FORMAT` | Cover image response format | orchestrator | `url` |
| `VOTE_THRESHOLD` | Votes needed to trigger next chapter | voting | `3` |

### Cloudflare Resources

| Resource | Purpose | Used By |
|----------|---------|---------|
| D1 Database | Structured data (users, books, chapters, votes) | auth, reading, submission, voting, character, orchestrator |
| R2 `*-core` | Book core files (worldbuilding, plot, characters) | reading, submission, voting, character, orchestrator |
| R2 `*-chapters` | Chapter content, summaries, hooks, items | reading, submission, voting, orchestrator |
| KV `*-cache` | Caching (tokens, rate limits) | auth, reading, submission, character, orchestrator |
| Queue `*-book-init` | Async book initialization tasks | submission (producer), orchestrator (consumer) |
| Queue `*-next-chapter` | Async next chapter generation tasks | voting (producer), orchestrator (consumer) |
| Vectorize `*-vectors` | Semantic search for chapters | orchestrator |
| Workers AI | Text embeddings | orchestrator |

## Data Flow

### Creating a Novel

```
Reader submits idea -> submission worker -> D1 (pending)
Admin approves      -> submission worker -> D1 (approved)
                                         -> Queue `*-book-init` (INIT_BOOK)
Orchestrator consumes:
  |-- Generate 3 core MD files -> R2 core bucket
  |-- Assemble context -> Generate chapter 1 -> R2 chapters bucket
  |-- Post-process (summary/hooks/items) -> R2 chapters bucket
  |-- Create direction options -> D1
  |-- Set book to active -> D1
```

### Voting -> Generation

```
Reader votes -> voting worker
  |-- D1: record vote
  |-- D1: update direction vote count
  |-- Durable Object: real-time counter
       |-- Threshold reached:
       |-- D1: mark winning/losing directions
       |-- Queue `*-next-chapter` (GENERATE_NEXT_CHAPTER)
Orchestrator consumes:
  |-- Assemble context from R2 (core MDs + recent 30 chapter summaries + hooks + items)
  |-- Call AI to generate chapter
  |-- Parse output (body + directions)
  |-- Store to R2 chapters bucket
  |-- Post-process
  |-- Update D1
```

## Local Development

```bash
# Install dependencies
pnpm install

# Terminal 1: API Gateway (starts other workers via service bindings)
cd workers/api-gateway && npx wrangler dev

# Terminal 2: Frontend
cd frontend-web && npm run dev

# Visit http://localhost:5173
```

## Cost

Runs entirely on Cloudflare Free Tier:
- **Workers**: 100K requests/day
- **D1**: 5M row reads/day, 100K row writes/day
- **R2**: 10GB storage, 1M Class A ops/month
- **KV**: 100K reads/day
- **Queues**: 1M messages/month

For small-to-medium projects, the free tier is more than sufficient.

## License

MIT License

Copyright (c) 2026 AI Novel Platform Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
