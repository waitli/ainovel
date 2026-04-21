# AI Novel Platform — 部署指南

## 架构概览

```
用户层:  读者 / 管理员 / 游客
  ↓
边缘层:  CF Pages (前端) + API Gateway Worker (统一入口)
  ↓
业务层:  auth / submission / voting / character / reading / orchestrator
  ↓
AI层:    上下文拼装 → Prompt构建 → 外部API → 后处理
  ↓
存储层:  R2(核心文件+章节) / D1(结构化数据) / KV(缓存)
```

## 前置要求

- Node.js >= 20
- pnpm: `npm install -g pnpm`
- Cloudflare 账号
- Wrangler CLI: `npm install -g wrangler`
- 登录 Wrangler: `wrangler login`

## 部署步骤

### 1. 安装依赖

```bash
cd /home/halcyon/ainovel
pnpm install
```

### 2. 创建 Cloudflare 资源

```bash
# D1 数据库
wrangler d1 create ainovel-db
# → 记下 database_id

# R2 存储桶
wrangler r2 bucket create ainovel-core
wrangler r2 bucket create ainovel-chapters

# KV 命名空间
wrangler kv namespace create ainovel-cache
# → 记下 id

# Queues
wrangler queues create ainovel-book-init
wrangler queues create ainovel-next-chapter
```

### 3. 配置 wrangler.toml

每个 worker 的 `wrangler.toml` 中需要替换:

- `YOUR_D1_DATABASE_ID` → D1 的 database_id
- `YOUR_KV_NAMESPACE_ID` → KV 的 id
- `CHANGE_ME_TO_A_SECURE_RANDOM_STRING` → 一个随机密钥 (用于 JWT 签名)
- `YOUR_AI_API_KEY` → 你的 OpenRouter / AI 提供商 API Key

### 4. 初始化数据库

```bash
wrangler d1 execute ainovel-db --local --file=schema/d1-schema.sql
# 远程环境用 --remote
```

### 5. 部署 Workers (按顺序)

```bash
# 共享包无需部署

# 认证服务
cd workers/auth && wrangler deploy

# 阅读服务 (其他服务依赖 D1，先部署这个)
cd ../reading && wrangler deploy

# 投稿审批
cd ../submission && wrangler deploy

# 投票系统 (包含 Durable Objects)
cd ../voting && wrangler deploy

# 角色申请
cd ../character && wrangler deploy

# AI 编排器
cd ../orchestrator && wrangler deploy

# API 网关 (最后部署，需要其他服务都存在)
cd ../api-gateway && wrangler deploy
```

### 6. 部署前端

```bash
cd frontend
npm run build
wrangler pages deploy dist --project-name=ainovel-frontend
```

### 7. 配置自定义域名 (可选)

在 Cloudflare Dashboard:
- Pages 项目绑定自定义域名
- Workers 路由绑定 API 域名

## 本地开发

```bash
# 启动所有服务需要多个终端
# 终端 1: API Gateway (会自动启动 service bindings)
cd workers/api-gateway && npx wrangler dev

# 终端 2: 前端
cd frontend && npx vite dev

# 访问 http://localhost:5173
```

## 数据流

### 创建新书的完整流程

```
读者提交投稿 → submission worker → D1(pending)
                                       ↓
管理员审批通过 → submission worker → D1(approved)
                                       ↓
                              Queue(ainovel-book-init / INIT_BOOK)
                                       ↓
orchestrator 消费Queue
  ├── 生成3个核心md → R2桶A
  ├── 拼装上下文 → 生成第一章 → R2桶B
  ├── 后处理(提要/钩子/物品) → R2桶B
  ├── 创建方向选项 → D1
  └── 更新书目为active → D1
```

### 投票→生成的流程

```
读者投票 → voting worker
  ├── D1: 记录投票
  ├── D1: 更新方向票数
  └── Durable Object: 实时计数
      ↓ 票数达标
  ├── D1: 标记胜出/失败方向
  └── Queue(ainovel-next-chapter / GENERATE_NEXT_CHAPTER)
      ↓
orchestrator 消费Queue
  ├── 从R2拼装上下文 (3个核心md + 最近30章提要 + 钩子 + 物品)
  ├── 调用AI生成章节
  ├── 解析输出 (正文 + 方向选项)
  ├── 存储到R2桶B
  ├── 后处理
  └── 更新D1
```

## R2 存储结构

```
ainovel-core (桶A — 核心文件)
└── books/{book_id}/
    ├── submission.json       # 投稿原始数据
    ├── worldbuilding.md      # 世界观
    ├── plot-architecture.md  # 情节架构
    └── character-state.md    # 角色状态

ainovel-chapters (桶B — 章节文件)
└── books/{book_id}/chapters/{num}/
    ├── content.md            # 章节正文
    ├── summary.md            # 前情提要
    ├── hooks.md              # 钩子/伏笔清单
    ├── items.md              # 物品清单
    └── directions.json       # 方向选项
```

## D1 表结构

- `users` — 用户表 (读者/管理员)
- `books` — 书目表 (含投稿JSON)
- `chapters` — 章节元数据
- `directions` — 方向选项
- `votes` — 投票记录
- `character_applications` — 角色申请

## 创建管理员

部署后手动插入一条管理员用户:

```sql
-- 先注册一个普通用户，然后:
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
```

## 环境变量清单

| 变量 | 说明 | 示例 |
|------|------|------|
| JWT_SECRET | JWT签名密钥 | 随机32位字符串 |
| AI_API_KEY | AI模型API密钥 | sk-or-v1-... |
| AI_MODEL | 模型名称 | anthropic/claude-sonnet-4-20250514 |
| AI_BASE_URL | API端点 | https://openrouter.ai/api/v1/chat/completions |
| COVER_API_KEY | 封面图模型API密钥（可选，不配则复用AI_API_KEY） | xxxxxxxx |
| COVER_BASE_URL | 封面图生成API端点 | https://ark.cn-beijing.volces.com/api/v3/images/generations |
| COVER_MODEL | 封面图模型名称 | doubao-seedream-4-5-251128 |
| COVER_SIZE | 封面图尺寸 | 2K |
| COVER_WATERMARK | 封面图是否带水印 | true |
| COVER_RESPONSE_FORMAT | 返回格式 | url |
| VOTE_THRESHOLD | 触发生成的票数 | 3 |

## 成本估算 (Cloudflare Free Tier)

- Workers: 10万次/天免费
- D1: 5百万行读取/天, 10万行写入/天
- R2: 10GB存储, 100万次A类操作/月
- KV: 10万次读取/天
- Queues: 1百万条/月

对于小型项目，Free Tier 完全够用。
