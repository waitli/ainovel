# AI Novel Platform — 完整系统流程文档

## 架构总览

```
用户浏览器 → Cloudflare Pages (前端)
    ↓ HTTPS
API Gateway Worker (统一入口, Service Binding 路由)
    ↓ Service Bindings
┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│   Auth   │  Submit  │  Voting  │ Reading  │Character │  Orch.   │
│  Worker  │  Worker  │  Worker  │  Worker  │  Worker  │  Worker  │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
    ↓           ↓           ↓           ↓
   D1         D1+R2       D1+DO       D1+R2
  (SQLite)   (文件)    (投票计数)    (缓存)
    ↓                       ↓
   KV                   Vectorize
  (缓存)              (语义搜索)
                         Workers AI
                        (Embedding)
```

**技术栈**: Cloudflare Workers + D1 + R2 (双桶) + KV + Durable Objects + Queue + Vectorize + Workers AI + Pages

**AI 模型**: gpt-5.4-mini (通过 cpa.waitli.top 代理) + Gemini 3.1 Flash Image (封面生成)

**域名**: ainovel.waitli.top (前端) / api.ainovel.waitli.top (API)

---

## 一、数据库设计 (D1)

6 张表：

| 表 | 用途 | 核心字段 |
|----|------|---------|
| `users` | 用户 | id, username, email, password_hash(PBKDF2), role(reader/admin) |
| `books` | 书目 | id, title, genre, language(zh/en), synopsis, status, submission_data(JSON), current_chapter, total_words |
| `chapters` | 章节元数据 | id, book_id, chapter_number, title, r2_content_key, winning_direction_id, word_count |
| `directions` | 方向选项 | id, chapter_id, direction_number, title, description, vote_count, status(voting/won/lost) |
| `votes` | 投票记录 | id, user_id, direction_id, chapter_id. UNIQUE(user_id, chapter_id) |
| `character_applications` | 角色申请 | id, book_id, character_data(JSON), status, ai_review |

**书目状态机**: `pending` → `approved` → `active` → `completed`
- `pending`: 用户提交，等待管理员审批
- `approved`: 管理员通过，orchestrator 开始生成
- `active`: 第一章生成完成，可阅读/投票
- `completed`: 达到目标章数
- `paused`: 拒绝/暂停

---

## 二、R2 存储结构

### 桶 A: `ainovel-core` (核心文件，低频更新)
```
books/{book_id}/
├── submission.json        # 投稿原始数据
├── worldbuilding.md       # 世界观设定 (AI 生成)
├── plot-architecture.md   # 情节架构 (AI 生成)
├── character-state.md     # 角色状态 (AI 生成 + 角色申请追加)
└── cover.png              # 封面图片 (AI 生成)
```

### 桶 B: `ainovel-chapters` (章节文件，高频更新)
```
books/{book_id}/chapters/{num}/
├── content.md             # 章节正文
├── summary.md             # 前情提要
├── hooks.md               # 钩子/伏笔
├── items.md               # 物品清单
└── directions.json        # 下一章方向选项
```

---

## 三、完整业务流程

### 流程 1: 用户注册/登录

```
用户 → POST /api/v1/auth/register {username, email, password}
  → Auth Worker
    → 检查用户名/邮箱唯一性
    → PBKDF2 哈希密码 (100k 次迭代, SHA-256, 16字节随机盐)
    → INSERT users (role='reader')
    → 生成 JWT (7天有效期)
    → 返回 {user, token}

用户 → POST /api/v1/auth/login {email, password}
  → Auth Worker
    → D1 查询用户, PBKDF2 验证密码 (恒定时间比较)
    → 生成 JWT
    → 返回 {user, token}

用户 → GET /api/v1/auth/me
  → Auth Worker
    → 验证 JWT (Authorization: Bearer <token>)
    → 返回用户信息
```

### 流程 2: 投稿新书

```
读者 → POST /api/v1/submissions
  Body: {
    title, genre, language(zh|en),
    worldview, outline, core_conflict, tone,
    characters: [{name, role, appearance, personality, motivation, backstory}]
  }

  → Submission Worker
    → 验证必填字段 (title, genre, worldview, outline, core_conflict + ≥1个角色)
    → AI 内容审核 (moderateSubmission)
      → 调用 gpt-5.4-mini 检查: 政治敏感/色情/暴力/犯罪/歧视
      → 返回 {risk_level, suggestion, reason, categories}
      → 不阻断，仅存审核建议供管理员参考
    → INSERT books (status='pending', submission_data=JSON, ai_review=JSON)
    → R2 写入 books/{bookId}/submission.json
    → 返回 {id, status:'pending', ai_suggestion, ai_risk}
```

### 流程 3: 管理员审批

```
管理员 → POST /api/v1/submissions/:id/approve
  → Submission Worker (requireAdmin)
    → UPDATE books SET status='approved'
    → 触发 Orchestrator (Service Binding, ctx.waitUntil):
      → POST https://orch/init-book
      → Body: {type:'INIT_BOOK', book_id, submission: {...}}
    → 返回 {id, status:'approved'}

管理员 → POST /api/v1/submissions/:id/reject {reason?}
  → Submission Worker (requireAdmin)
    → UPDATE books SET status='paused', synopsis=reason
    → 返回 {id, status:'rejected'}
```

### 流程 4: AI 初始化生成 (第一章)

这是系统的核心，由 Orchestrator Worker 执行：

```
Orchestrator → handleInitBook({book_id, submission})
│
├── 1. 生成核心文件
│   buildInitPrompt(submission, language)
│   → generateCoreFiles(prompt, aiConfig)
│   → AI 返回包含 3 个文件的内容:
│     ===FILE:worldbuilding===
│     ===FILE:plot-architecture===
│     ===FILE:character-state===
│   → 解析并写入 R2_CORE 桶
│
├── 2. 组装章节上下文 (context-assembler.ts)
│   assembleContext(book_id, 0, null, R2_CORE, R2_CHAPTERS, DB)
│   → 并行读取 R2:
│     - worldbuilding.md
│     - plot-architecture.md
│     - character-state.md
│     - hooks.md, items.md
│     - 最近 30 章的 summary.md (并行)
│   → 读取 D1: winning direction (第一章无)
│   → 读取 R2: submission.json
│   → 返回 GenerationContext 对象
│
├── 3. 向量索引 (世界规则 + 角色)
│   → Workers AI 生成 embedding (@cf/baai/bge-base-en-v1.5, 768维)
│   → 存入 Vectorize (metadata: book_id, type, name, content)
│
├── 4. 生成第一章
│   buildChapterPrompt(ctx, language)
│   → generateChapter(prompt, aiConfig)
│   → AI 返回: 章节正文 + 方向选项
│   → 解析 (parseChapterOutput):
│     分割符: "## 后续发展方向"(中文) / "## What Happens Next?"(英文)
│     方向格式: "方向A:"/"Option A:" + 标题 + 描述
│
├── 5. 存储章节
│   → R2_CHAPTERS: content.md, directions.json
│   → R2_CHAPTERS: summary.md (取正文前200字)
│   → D1: INSERT chapters (status='published')
│   → D1: INSERT directions × (2-4个)
│
├── 6. 更新书目状态
│   synopsis = submission.worldview + submission.outline
│   → UPDATE books SET status='active', current_chapter=1, language=?, synopsis=?
│
└── 7. 生成封面 (可选, 失败不阻断)
    → 调用 Gemini 3.1 Flash Image
    → R2 写入 books/{bookId}/cover.png
```

**提示词设计 (3 大写作框架)**:
- **雪花写作法**: 从核心种子逐层扩展
- **角色弧光理论**: 驱动三角 (欲望/恐惧/缺陷), 关系冲突网络
- **悬念节奏曲线**: 认知过山车, 章末钩子

**字数目标**: 中文 2000-4000 字 / 英文 1500-3000 词

### 流程 5: 读者投票

```
读者 → POST /api/v1/votes {direction_id}
  → Voting Worker (requireAuth)
    → D1 验证方向存在且 status='voting'
    → D1 UNIQUE(user_id, chapter_id) 防重复投票
    → INSERT votes
    → UPDATE directions SET vote_count+1
    → Durable Object VoteCounter:
      → POST /vote {user_id, direction_id}
      → 原子递增计数 (单线程, 防并发)
      → 如果某方向 ≥ 阈值(3票):
        → 返回 {should_trigger:true, winning_direction}
    → 如果 should_trigger:
      → UPDATE directions SET status='won' (胜出方向)
      → UPDATE directions SET status='lost' (其他方向)
      → 触发 Orchestrator (Service Binding, ctx.waitUntil):
        → POST https://orch/generate-chapter
        → Body: {type:'GENERATE_NEXT_CHAPTER', book_id, chapter_id, winning_direction_id}
    → 返回 {vote_id, triggered, current_votes, threshold}
```

**Durable Object (VoteCounter)**:
- 每章一个实例 (idFromName(chapter_id))
- 状态: {direction_counts, total_votes, threshold, is_triggered}
- 单线程保证: 同时 100 人投票也不会计数错误
- 端点: POST /init, POST /vote, GET /status

### 流程 6: AI 生成下一章

```
Orchestrator → handleGenerateNextChapter({book_id, chapter_id, winning_direction_id})
│
├── 1. 读取当前状态
│   D1: SELECT current_chapter, language FROM books
│   → nextChapter = currentChapter + 1
│
├── 2. 组装上下文 (同流程4)
│   assembleContext(book_id, currentChapter, winning_direction_id, ...)
│   → 多了 winning direction 的内容
│
├── 3. 向量一致性搜索
│   getConsistencyContext(book_id, outline, AI, VECTORIZE, language)
│   → 搜索: 相关角色(×3) + 世界规则(×3) + 活跃伏笔(×3) + 相关物品(×3)
│   → 注入到 AI 提示词中, 防止前后矛盾
│
├── 4. 生成章节
│   generateChapter(prompt, aiConfig, consistencyContext, language)
│
├── 5. 后处理 (postProcessChapter)
│   postProcessChapter(chapterContent, nextChapter, ctx, aiConfig, language)
│   → AI 生成: summary + hooks + items
│   → 分割符: ===FILE:summary===, ===FILE:hooks===, ===FILE:items===
│   → 失败不阻断章节发布
│
├── 6. 存储
│   → R2_CHAPTERS: content.md, summary.md, hooks.md, items.md, directions.json
│   → D1: INSERT chapters + INSERT directions
│   → D1: UPDATE books SET current_chapter++, total_words+=length
│
├── 7. 向量索引
│   → indexPlotEvent (情节事件)
│   → indexHook (新伏笔)
│   → indexItem (新物品)
│
└── 8. 方向状态更新
    → winning direction: status='won'
    → 其他方向: status='lost'
```

### 流程 7: 阅读

```
用户 → GET /api/v1/books?status=active&lang=zh|en
  → Reading Worker (公开, 无需登录)
    → D1 查询 (WHERE status=? AND language=?)
    → KV 缓存 (5分钟 TTL)
    → 返回 {books[], page, limit}

用户 → GET /api/v1/books/:id/chapters/:num
  → Reading Worker
    → D1: 查章节元数据
    → R2_CHAPTERS: 读 content.md 正文
    → R2_CHAPTERS: 读 summary.md 前情提要
    → D1: 查询方向选项
    → 返回 {chapter, content, summary, directions[]}
```

### 流程 8: 角色申请

```
读者 → POST /api/v1/books/:id/characters/apply {name, appearance, personality, ...}
  → Character Worker
    → AI 内容审核 (moderateCharacterApplication)
    → INSERT character_applications (status='pending')

管理员 → POST /api/v1/characters/applications/:id/approve
  → Character Worker
    → UPDATE status='approved'
    → 读取 R2_CORE: character-state.md
    → 生成 markdown 角色条目 (generateCharacterMarkdown)
    → 追加到 character-state.md
    → R2 写回
```

---

## 四、双语支持 (i18n)

### 数据层
- `books.language`: 'zh' | 'en', 每本书锁定一种语言
- 投稿时选择语言 → 存入 D1 → orchestrator 使用对应语言的提示词
- 阅读列表按 `?lang=zh|en` 过滤，切换语言只显示对应语言的书

### 提示词层 (orchestrator)
- 所有提示词都有中英双版本
- 系统提示词: `SYSTEM_PROMPT_CHAPTER` / `SYSTEM_PROMPT_CHAPTER_EN`
- 输出格式: `# 第N章 标题` / `# Chapter N: Title`
- 方向标记: `## 后续发展方向` / `## What Happens Next?`
- 向量元数据: `角色:` / `Character:`, `伏笔:` / `Foreshadowing:`

### 前端层
- i18next, 92 个翻译 key, 默认英文
- 🌐 切换按钮 → localStorage → i18n.changeLanguage() → 重新请求书列表
- 类型列表: GENRES_ZH / GENRES_EN 按语言切换
- 字数格式: "3万" (中文) / "30k" (英文)

---

## 五、API 端点总览

| Worker | 方法 | 路径 | 认证 | 说明 |
|--------|------|------|------|------|
| Auth | POST | /auth/register | - | 注册 |
| Auth | POST | /auth/login | - | 登录 |
| Auth | GET | /auth/me | ✓ | 用户信息 |
| Submit | POST | /submissions | ✓ | 投稿 |
| Submit | GET | /submissions | ✓ | 投稿列表 |
| Submit | GET | /submissions/:id | ✓ | 投稿详情 |
| Submit | POST | /submissions/:id/approve | Admin | 审批通过 |
| Submit | POST | /submissions/:id/reject | Admin | 拒绝 |
| Voting | POST | /votes | ✓ | 投票 |
| Voting | GET | /chapters/:id/directions | ✓ | 方向列表 |
| Voting | GET | /chapters/:id/votes/status | ✓ | 投票状态 |
| Reading | GET | /books | - | 书目列表 (公开) |
| Reading | GET | /books/:id | - | 书目详情 (公开) |
| Reading | GET | /books/:id/chapters | - | 章节列表 (公开) |
| Reading | GET | /books/:id/chapters/:num | - | 章节正文 (公开) |
| Reading | GET | /books/:id/cover | - | 封面图片 (公开) |
| Char | POST | /books/:id/characters/apply | ✓ | 角色申请 |
| Char | GET | /books/:id/characters/applications | Admin | 申请列表 |
| Char | POST | /characters/applications/:id/approve | Admin | 批准角色 |
| Char | GET | /books/:id/characters | ✓ | 已有角色列表 |

---

## 六、已知问题和后续优化

### 已解决
- ✅ Queue consumer + cron trigger 冲突 → 改用 Service Binding (ctx.waitUntil)
- ✅ 双语支持 (UI + 提示词 + 数据过滤)
- ✅ 章节段落渲染 (按空行分段, 2em 缩进)
- ✅ 简介自动生成 (worldview + outline)

### 待解决
- ⚠️ Cron trigger 已禁用: 投票达标后通过 DO 立即触发生成, cron 仅作为备份检查. 后续可创建独立 cron worker
- ⚠️ 封面生成依赖 Gemini API: 需要单独配置 API key, 当前可能超时
- ⚠️ 章节字数统计: 中文按字符数统计, 英文按单词数统计, 目前统一用字符数

### 扩展建议
- 多语言: 框架已支持, 可扩展日文/韩文等
- 移动端: 用 Capacitor 包装前端即可
- 社交功能: 收藏、评论、关注
- 支付: 章节解锁、打赏作者
