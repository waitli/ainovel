# AI Novel Platform — 当前系统架构总览

## 平台概况

- **前端**: https://ainovel.waitli.top (Cloudflare Pages)
- **API**: https://api.ainovel.waitli.top (API Gateway Worker)
- **AI 模型**: gpt-5.4-mini (通过 cpa.waitli.top 代理)
- **邮箱**: Resend (noreply@waitli.top)
- **数据库**: 16 本书 (9 中文 + 7 英文), 16 章节, 81,895 字

---

## 7 个 Worker

### 1. ainovel-api (API Gateway)
**角色**: 统一入口，路由分发

| 路由规则 | 目标 Worker |
|----------|------------|
| /api/v1/auth/*, /api/v1/admin/users/* | Auth |
| /api/v1/submissions/*, /api/v1/admin/approve-book/*, /api/v1/admin/reject-book/* | Submission |
| /api/v1/votes/*, /api/v1/chapters/*/directions/* | Voting |
| /api/v1/books/*, /api/v1/chapters/*, /api/v1/admin/books/* | Reading |
| /api/v1/books/*/characters/*, /api/v1/characters/*, /api/v1/admin/*-character/* | Character |

- CORS 头自动添加
- 健康检查: GET /api/health

### 2. ainovel-auth (认证)
**功能**:
- POST /auth/register — 注册（需要邮箱验证码）
- POST /auth/send-code — 发送 6 位验证码（Resend 邮件，10 分钟有效）
- POST /auth/login — 登录，返回 JWT（7 天有效期）
- GET /auth/me — 当前用户信息
- GET /admin/users — 用户列表（管理员）
- PUT /admin/users/:id/role — 修改角色（管理员）
- DELETE /admin/users/:id — 删除用户（管理员，级联清理）

**密码**: PBKDF2 (100k 次迭代, SHA-256)
**安全**: 用户名禁止包含 @（防止浏览器 autofill 混淆邮箱和用户名）

### 3. ainovel-submission (投稿)
**功能**:
- POST /submissions — 提交新书（读者），触发 AI 内容审核 + 发邮件通知管理员
- GET /submissions — 投稿列表（管理员看全部，读者看自己的）
- GET /submissions/:id — 投稿详情
- POST /submissions/:id/approve — 审批通过，发送 Queue 消息触发 AI 生成
- POST /submissions/:id/reject — 拒绝
- GET /admin/approve-book/:id — 邮件审批链接（HMAC token 验证）
- GET /admin/reject-book/:id — 邮件拒绝链接

**流程**: 投稿 → AI 审核(不阻断) → 管理员审批 → Queue → Orchestrator 生成
**限制**: 管理员不能投稿（403）

### 4. ainovel-voting (投票)
**功能**:
- POST /votes — 投票（1 票即触发下一章）
- GET /chapters/:id/directions — 方向选项列表
- GET /chapters/:id/votes/status — 实时投票状态
- POST /admin/books/:bookId/chapters/:num/directions — 管理员创建方向

**Durable Object**: 每章一个 VoteCounter 实例，原子计数防并发
**流程**: 用户投票 → D1 + DO 计数 → 达阈值 → Queue → Orchestrator 生成下一章
**限制**: 每用户每章只能投 1 票，管理员不能投票（403）

### 5. ainovel-reading (阅读)
**功能**:
- GET /books — 书目列表（公开，按 language 过滤，KV 缓存 5 分钟）
- GET /books/:id — 书目详情（公开）
- GET /books/:id/chapters — 章节列表（公开）
- GET /books/:id/chapters/:num — 章节正文（公开，从 R2 读取）
- GET /books/:id/chapters/:num/directions — 方向选项（公开）
- GET /books/:id/worldbuilding — 世界观文件（公开）
- GET /books/:id/cover — 封面图片（公开）
- DELETE /admin/books/:id — 删除书籍（管理员，级联删除章节/方向/投票/角色申请）

**双语过滤**: ?lang=zh 只返回中文书，?lang=en 只返回英文书

### 6. ainovel-character (角色)
**功能**:
- POST /books/:id/characters/apply — 角色申请（读者），触发 AI 审核 + 邮件通知
- GET /books/:id/characters/applications — 申请列表（管理员）
- GET /characters/applications/my — 我的申请（读者）
- POST /characters/applications/:id/approve — 审批通过，追加到 character-state.md
- POST /characters/applications/:id/reject — 拒绝
- GET /books/:id/characters — 已有角色列表
- GET /admin/approve-character/:id — 邮件审批链接
- GET /admin/reject-character/:id — 邮件拒绝链接

**限制**: 管理员不能申请角色（403）

### 7. ainovel-orchestrator (AI 生成引擎)
**入口**: Queue Consumer（监听 ainovel-book-init + ainovel-next-chapter 两个队列）

**INIT_BOOK 流程**:
1. buildInitPrompt → AI 生成 3 个核心文件 (worldbuilding.md, plot-architecture.md, character-state.md)
2. 写入 R2 桶 A
3. assembleContext 组装上下文
4. buildChapterPrompt → AI 生成第一章 + 方向选项
5. 写入 R2 桶 B
6. D1 写入章节 + 方向记录
7. 更新书目状态为 active
8. 向量索引（角色 + 世界观）
9. AI 生成封面（可选）
10. 自动生成简介（worldview + outline）

**GENERATE_NEXT_CHAPTER 流程**:
1. assembleContext（含 winning direction）
2. 向量一致性搜索（角色/规则/伏笔/物品）
3. AI 生成下一章 + 方向选项
4. 后处理：摘要/钩子/物品清单
5. 写入 R2 + D1
6. 向量索引新内容

**双语支持**: 提示词/输出格式/向量标签全部中英双版本

**已禁用**: Cron trigger（与 Queue consumer 冲突）

---

## 存储层

### D1 数据库 (ainovel-db)
6 张表: users, books(+language 列), chapters, directions, votes, character_applications

### R2 双桶
- ainovel-core: submission.json, worldbuilding.md, plot-architecture.md, character-state.md, cover.png
- ainovel-chapters: content.md, summary.md, hooks.md, items.md, directions.json

### KV (ainovel-cache)
- 书目列表缓存 (5 分钟 TTL)
- 邮箱验证码 (10 分钟 TTL)

### Vectorize (ainovel-vectors)
- 768 维向量，语义搜索保证角色/世界观一致性

### Durable Objects (VoteCounter)
- 每章一个实例，原子投票计数

---

## 前端页面

| 路径 | 组件 | 权限 | 说明 |
|------|------|------|------|
| / | Home | 公开 | 书目列表（按语言过滤）+ 热度榜 |
| /books/:id | BookDetail | 公开 | 书目详情 + 章节目录 |
| /books/:id/chapters/:num | Chapter | 公开 | 阅读正文 + 投票 |
| /submit | Submit | 登录 | 投稿表单（管理员不可用） |
| /login | Login | 公开 | 读者登录 |
| /register | Register | 公开 | 注册（邮箱验证码） |
| /admin/login | AdminLogin | 公开 | 管理员独立登录 |
| /admin | Admin | 管理员 | 5 Tab 管理面板 |

### Admin 面板 5 Tab
1. **Dashboard** — 总书籍/总章节/总字数/待审核数
2. **Book Approval** — 待审核新书 + AI 审核建议 + 通过/拒绝
3. **Character Approval** — 待审核角色申请
4. **Book Management** — 全部书籍（active/approved/pending）+ 删除
5. **User Management** — 用户列表 + 角色切换 + 删除

### 管理员隔离
- 管理员登录后自动跳转 /admin
- 无法访问前台页面（HomeGuard 重定向）
- 导航栏只显示 Admin + 退出
- 不能投稿/投票/申请角色（后端 403）

---

## 邮件系统 (Resend)

| 触发时机 | 收件人 | 内容 |
|----------|--------|------|
| 新书投稿 | waitli@outlook.com | 书名/类型/语言 + 审批/拒绝链接 |
| 角色申请 | waitli@outlook.com | 角色名/书名 + 审批/拒绝链接 |
| 用户注册 | 注册邮箱 | 6 位验证码 |

---

## 双语系统

| 层级 | 实现 |
|------|------|
| 数据 | books.language = zh/en，按语言过滤 |
| 提示词 | prompt-builder/ai-caller 中英双版本 |
| 向量 | 元数据标签中英双语 |
| 前端 | i18next 92 keys，默认英文 |
| 切换 | 🌐 按钮 → localStorage → 重新请求书列表 |
