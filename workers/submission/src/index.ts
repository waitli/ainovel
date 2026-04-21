import type { SubmissionEnv, SubmissionData, Book, Chapter, Direction } from '../../../shared/src/index';
import {
  generateId, unixNow,
  successResponse, errorResponse, notFoundError,
  unauthorizedError, forbiddenError, corsResponse,
  parseBody, d1FirstRow,
  requireAuth, requireAdmin,
  generateActionToken, verifyActionToken,
  sendAdminNotification,
  bumpBooksCacheVersion,
  CorePaths, ChapterPaths,
  BookStatus, ChapterStatus,
} from '../../../shared/src/index';

export default {
  async fetch(request: Request, env: SubmissionEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    // CORS 预检
    if (method === 'OPTIONS') return corsResponse();

    try {
      // ---- 路由 ----

      // POST /api/v1/submissions — 读者提交新书投稿
      if (method === 'POST' && pathname === '/api/v1/submissions') {
        return await handleSubmit(request, env, ctx);
      }

      // GET /api/v1/submissions — 获取投稿列表
      if (method === 'GET' && pathname === '/api/v1/submissions') {
        return await handleList(request, env);
      }

      // GET /api/v1/submissions/:id — 获取投稿详情
      if (method === 'GET' && pathname.match(/^\/api\/v1\/submissions\/[^/]+$/)) {
        const id = pathname.split('/')[4];
        return await handleGet(id, request, env);
      }

      // POST /api/v1/submissions/:id/approve — 管理员审批通过
      if (method === 'POST' && pathname.match(/^\/api\/v1\/submissions\/[^/]+\/approve$/)) {
        const id = pathname.split('/')[4];
        return await handleApprove(id, request, env, ctx);
      }

      // POST /api/v1/submissions/:id/reject — 管理员拒绝
      if (method === 'POST' && pathname.match(/^\/api\/v1\/submissions\/[^/]+\/reject$/)) {
        const id = pathname.split('/')[4];
        return await handleReject(id, request, env);
      }

      // GET /api/v1/admin/approve-book/:id — Email action link approve
      if (method === 'GET' && pathname.match(/^\/api\/v1\/admin\/approve-book\/[^/]+$/)) {
        const id = pathname.split('/')[5];
        return await handleAdminApproveBook(id, url, env);
      }

      // GET /api/v1/admin/reject-book/:id — Email action link reject
      if (method === 'GET' && pathname.match(/^\/api\/v1\/admin\/reject-book\/[^/]+$/)) {
        const id = pathname.split('/')[5];
        return await handleAdminRejectBook(id, url, env);
      }

      return notFoundError('Endpoint');

    } catch (err: any) {
      if (err.message === 'UNAUTHORIZED') return unauthorizedError();
      if (err.message === 'FORBIDDEN') return forbiddenError();
      console.error('Submission Worker Error:', err);
      return errorResponse(`Error: ${err.message}`, 500);
    }
  },
};

// ============================================
// 处理函数
// ============================================

/**
 * 读者提交新书投稿
 */
async function handleSubmit(request: Request, env: SubmissionEnv, ctx: ExecutionContext): Promise<Response> {
  const auth = await requireAuth(request, env.JWT_SECRET);
  if (auth.isAdmin) return errorResponse('Admin accounts cannot submit novels', 403);
  const body = await parseBody<SubmissionData>(request);
  const language = body.language || 'zh';

  // 校验必填字段
  if (!body.title || !body.genre || !body.worldview || !body.outline || !body.core_conflict) {
    return errorResponse('Missing required fields: title, genre, worldview, outline, core_conflict');
  }

  if (!body.characters || body.characters.length === 0) {
    return errorResponse('At least one character is required');
  }

  // AI 内容初审 (不拒绝，给管理员审核建议)
  const { moderateSubmission } = await import('./content-moderator');
  const aiReview = await moderateSubmission(body, env.AI_API_KEY, env.AI_BASE_URL, language);

  const submissionId = generateId();
  const now = unixNow();

  // 写入 D1 (附带 AI 审核意见)
  await env.DB.prepare(`
    INSERT INTO books (id, title, genre, language, status, submitted_by, r2_core_prefix, submission_data, ai_review, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)
  `).bind(
    submissionId,
    body.title,
    body.genre,
    language,
    auth.userId,
    `books/${submissionId}/`,
    JSON.stringify(body),
    JSON.stringify(aiReview),
    now,
    now
  ).run();

  // 投稿原始数据也存到 R2 桶A
  await env.R2_CORE.put(
    CorePaths.submission(submissionId),
    JSON.stringify(body, null, 2),
    { httpMetadata: { contentType: 'application/json' } }
  );

  // Send admin notification email (non-blocking)
  const approveToken = await generateActionToken(submissionId, 'approve', env.JWT_SECRET);
  const rejectToken = await generateActionToken(submissionId, 'reject', env.JWT_SECRET);
  const detailUrl = `https://api.ainovel.waitli.top/api/v1/submissions/${submissionId}`;
  const approveUrl = `https://api.ainovel.waitli.top/api/v1/admin/approve-book/${submissionId}?token=${approveToken}`;
  const rejectUrl = `https://api.ainovel.waitli.top/api/v1/admin/reject-book/${submissionId}?token=${rejectToken}`;
  const adminTitle = `"${body.title}" (${body.genre}) — ${language} — by user ${auth.userId}`;
  ctx.waitUntil(
    sendAdminNotification(env, 'book_submission', adminTitle, detailUrl, approveUrl, rejectUrl)
      .catch(e => console.error('Admin notification failed:', e.message))
  );

  return successResponse(
    {
      id: submissionId,
      status: 'pending',
      ai_suggestion: aiReview.suggestion,
      ai_risk: aiReview.risk_level,
    },
    'Submission created successfully, awaiting admin approval'
  );
}

/**
 * 获取投稿列表
 * - 管理员: 看所有 pending 投稿
 * - 读者: 看自己的所有投稿
 */
async function handleList(request: Request, env: SubmissionEnv): Promise<Response> {
  const auth = await requireAuth(request, env.JWT_SECRET);
  const url = new URL(request.url);
  const status = url.searchParams.get('status') || 'pending';
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);
  const offset = (page - 1) * limit;

  let query: string;
  let params: any[];

  if (auth.isAdmin) {
    // 管理员: 查指定状态的所有投稿
    query = `SELECT * FROM books WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params = [status, limit, offset];
  } else {
    // 读者: 查自己的投稿
    query = `SELECT * FROM books WHERE submitted_by = ? AND status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params = [auth.userId, status, limit, offset];
  }

  const result = await env.DB.prepare(query).bind(...params).all();

  return successResponse({
    books: result.results,
    page,
    limit,
    total: result.results.length,
  });
}

/**
 * 获取投稿详情
 */
async function handleGet(id: string, request: Request, env: SubmissionEnv): Promise<Response> {
  const auth = await requireAuth(request, env.JWT_SECRET);

  const book = await env.DB.prepare(
    `SELECT * FROM books WHERE id = ?`
  ).bind(id).first<Book>();

  if (!book) return notFoundError('Submission');

  // 非管理员只能看自己的
  if (!auth.isAdmin && book.submitted_by !== auth.userId) {
    return forbiddenError();
  }

  // 解析 submission_data
  const data: any = {
    ...book,
    submission_data: JSON.parse(book.submission_data),
  };

  // 解析 AI 审核意见 (管理员可见)
  if (book.ai_review) {
    try {
      data.ai_review = JSON.parse(book.ai_review);
    } catch {}
  }

  return successResponse(data);
}

/**
 * 管理员审批通过 → 创建书目 + 生成第一章
 */
async function handleApprove(id: string, request: Request, env: SubmissionEnv, ctx: ExecutionContext): Promise<Response> {
  const auth = await requireAdmin(request, env.JWT_SECRET);

  // 查找投稿
  const book = await env.DB.prepare(
    `SELECT * FROM books WHERE id = ? AND status = 'pending'`
  ).bind(id).first<Book>();

  if (!book) return notFoundError('Pending submission');

  const now = unixNow();

  // 更新书目状态为 approved
  await env.DB.prepare(`
    UPDATE books SET status = 'approved', approved_by = ?, approved_at = ?, updated_at = ?
    WHERE id = ?
  `).bind(auth.userId, now, now, id).run();

  // 发送到 Queue → orchestrator consumer 自动处理
  await env.ORCHESTRATOR_QUEUE.send({
    type: 'INIT_BOOK',
    book_id: id,
    submission: JSON.parse(book.submission_data),
  });
  await bumpBooksCacheVersion(env.KV);

  return successResponse(
    { id, status: 'approved' },
    'Book approved. Chapter 1 generation queued.'
  );
}

/**
 * 管理员拒绝投稿
 */
async function handleReject(id: string, request: Request, env: SubmissionEnv): Promise<Response> {
  const auth = await requireAdmin(request, env.JWT_SECRET);
  const body = await parseBody<{ reason?: string }>(request);

  const book = await env.DB.prepare(
    `SELECT * FROM books WHERE id = ? AND status = 'pending'`
  ).bind(id).first<Book>();

  if (!book) return notFoundError('Pending submission');

  const now = unixNow();

  await env.DB.prepare(`
    UPDATE books SET status = 'paused', approved_by = ?, approved_at = ?, updated_at = ?,
    synopsis = ?
    WHERE id = ?
  `).bind(auth.userId, now, now, body.reason || 'Rejected by admin', id).run();
  await bumpBooksCacheVersion(env.KV);

  return successResponse({ id, status: 'rejected' }, 'Submission rejected');
}

// ============================================
// Admin Email Action Handlers (token-based)
// ============================================

function actionSuccessHtml(title: string, message: string): Response {
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${title}</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f9fafb}
.card{background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.1);padding:40px;max-width:480px;text-align:center}
h1{color:#7c3aed;margin:0 0 16px}p{color:#374151;font-size:15px;line-height:1.6}
.badge{display:inline-block;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:600;color:#fff}
.success{background:#059669}.error{background:#dc2626}</style></head>
<body><div class="card"><h1>AI Novel Platform</h1><p>${message}</p></div></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}

async function handleAdminApproveBook(id: string, url: URL, env: SubmissionEnv): Promise<Response> {
  const token = url.searchParams.get('token');
  if (!token) return actionSuccessHtml('Error', 'Missing action token.');

  const valid = await verifyActionToken(id, 'approve', env.JWT_SECRET, token);
  if (!valid) return actionSuccessHtml('Error', 'Invalid or expired action token.');

  const book = await env.DB.prepare(
    `SELECT * FROM books WHERE id = ? AND status = 'pending'`
  ).bind(id).first<Book>();

  if (!book) return actionSuccessHtml('Not Found', 'Book not found or already processed.');

  const now = unixNow();
  await env.DB.prepare(`
    UPDATE books SET status = 'approved', approved_at = ?, updated_at = ?
    WHERE id = ?
  `).bind(now, now, id).run();

  // 邮件审批路径需要与后台审批一致：入队触发 INIT_BOOK
  await env.ORCHESTRATOR_QUEUE.send({
    type: 'INIT_BOOK',
    book_id: id,
    submission: JSON.parse(book.submission_data),
  });
  await bumpBooksCacheVersion(env.KV);

  return actionSuccessHtml('Approved', `"${book.title}" has been approved. Chapter 1 generation queued.`);
}

async function handleAdminRejectBook(id: string, url: URL, env: SubmissionEnv): Promise<Response> {
  const token = url.searchParams.get('token');
  if (!token) return actionSuccessHtml('Error', 'Missing action token.');

  const valid = await verifyActionToken(id, 'reject', env.JWT_SECRET, token);
  if (!valid) return actionSuccessHtml('Error', 'Invalid or expired action token.');

  const book = await env.DB.prepare(
    `SELECT * FROM books WHERE id = ? AND status = 'pending'`
  ).bind(id).first<Book>();

  if (!book) return actionSuccessHtml('Not Found', 'Book not found or already processed.');

  const now = unixNow();
  await env.DB.prepare(`
    UPDATE books SET status = 'paused', approved_at = ?, updated_at = ?,
    synopsis = 'Rejected via email action'
    WHERE id = ?
  `).bind(now, now, id).run();
  await bumpBooksCacheVersion(env.KV);

  return actionSuccessHtml('Rejected', `"${book.title}" has been rejected.`);
}
