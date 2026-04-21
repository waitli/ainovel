import type { CharacterEnv, CharacterApplication, CharacterDetail } from '../../../shared/src/index';
import {
  generateId, unixNow,
  successResponse, errorResponse, notFoundError,
  unauthorizedError, forbiddenError, corsResponse,
  parseBody, d1FirstRow,
  requireAuth, requireAdmin,
  generateActionToken, verifyActionToken,
  sendAdminNotification,
  CorePaths,
} from '../../../shared/src/index';

export default {
  async fetch(request: Request, env: CharacterEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    if (method === 'OPTIONS') return corsResponse();

    try {
      // POST /api/v1/books/:bookId/characters/apply — 读者申请角色入书
      if (method === 'POST' && pathname.match(/^\/api\/v1\/books\/[^/]+\/characters\/apply$/)) {
        const bookId = pathname.split('/')[4];
        return await handleApply(bookId, request, env, ctx);
      }

      // GET /api/v1/books/:bookId/characters/applications — 获取某书的角色申请列表
      if (method === 'GET' && pathname.match(/^\/api\/v1\/books\/[^/]+\/characters\/applications$/)) {
        const bookId = pathname.split('/')[4];
        return await handleListApplications(bookId, request, env);
      }

      // GET /api/v1/characters/applications/my — 获取我的角色申请
      if (method === 'GET' && pathname === '/api/v1/characters/applications/my') {
        return await handleMyApplications(request, env);
      }

      // POST /api/v1/characters/applications/:id/approve — 管理员审批通过
      if (method === 'POST' && pathname.match(/^\/api\/v1\/characters\/applications\/[^/]+\/approve$/)) {
        const appId = pathname.split('/')[5];
        return await handleApprove(appId, request, env);
      }

      // POST /api/v1/characters/applications/:id/reject — 管理员拒绝
      if (method === 'POST' && pathname.match(/^\/api\/v1\/characters\/applications\/[^/]+\/reject$/)) {
        const appId = pathname.split('/')[5];
        return await handleReject(appId, request, env);
      }

      // GET /api/v1/books/:bookId/characters — 获取书中已批准的角色列表
      if (method === 'GET' && pathname.match(/^\/api\/v1\/books\/[^/]+\/characters$/)) {
        const bookId = pathname.split('/')[4];
        return await handleListCharacters(bookId, request, env);
      }

      // GET /api/v1/admin/approve-character/:id — Email action link approve
      if (method === 'GET' && pathname.match(/^\/api\/v1\/admin\/approve-character\/[^/]+$/)) {
        const id = pathname.split('/')[5];
        return await handleAdminApproveCharacter(id, url, env);
      }

      // GET /api/v1/admin/reject-character/:id — Email action link reject
      if (method === 'GET' && pathname.match(/^\/api\/v1\/admin\/reject-character\/[^/]+$/)) {
        const id = pathname.split('/')[5];
        return await handleAdminRejectCharacter(id, url, env);
      }

      return notFoundError('Endpoint');

    } catch (err: any) {
      if (err.message === 'UNAUTHORIZED') return unauthorizedError();
      if (err.message === 'FORBIDDEN') return forbiddenError();
      console.error('Character Worker Error:', err);
      return errorResponse('Internal server error', 500);
    }
  },
};

// ============================================
// 处理函数
// ============================================

/**
 * 读者申请角色入书
 */
async function handleApply(
  bookId: string,
  request: Request,
  env: CharacterEnv,
  ctx: ExecutionContext
): Promise<Response> {
  const auth = await requireAuth(request, env.JWT_SECRET);
  if (auth.isAdmin) return errorResponse('Admin accounts cannot apply characters', 403);
  const book = await env.DB.prepare(
    `SELECT id, title, status FROM books WHERE id = ? AND status IN ('approved', 'active')`
  ).bind(bookId).first<{ id: string; title: string; status: string }>();

  if (!book) {
    return errorResponse('Book not found or not accepting characters');
  }

  const body = await parseBody<CharacterDetail>(request);

  // 校验必填字段
  if (!body.name || !body.appearance || !body.personality || !body.backstory || !body.motivation) {
    return errorResponse('Missing required fields: name, appearance, personality, backstory, motivation');
  }

  // AI 内容初审 (不拒绝，给管理员审核建议)
  const { moderateCharacterApplication } = await import('./content-moderator');
  const aiReview = await moderateCharacterApplication(body, book.title, env.AI_API_KEY, env.AI_BASE_URL);

  const appId = generateId();
  const now = unixNow();

  await env.DB.prepare(`
    INSERT INTO character_applications
    (id, book_id, applicant_id, character_name, character_data, ai_review, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
  `).bind(
    appId,
    bookId,
    auth.userId,
    body.name,
    JSON.stringify(body),
    JSON.stringify(aiReview),
    now
  ).run();

  // Send admin notification email (non-blocking)
  const approveToken = await generateActionToken(appId, 'approve', env.JWT_SECRET);
  const rejectToken = await generateActionToken(appId, 'reject', env.JWT_SECRET);
  const detailUrl = `https://api.ainovel.waitli.top/api/v1/books/${bookId}/characters/applications`;
  const approveUrl = `https://api.ainovel.waitli.top/api/v1/admin/approve-character/${appId}?token=${approveToken}`;
  const rejectUrl = `https://api.ainovel.waitli.top/api/v1/admin/reject-character/${appId}?token=${rejectToken}`;
  const adminTitle = `Character "${body.name}" for "${book.title}" — by user ${auth.userId}`;
  ctx.waitUntil(
    sendAdminNotification(env, 'character_application', adminTitle, detailUrl, approveUrl, rejectUrl)
      .catch(e => console.error('Admin notification failed:', e.message))
  );

  return successResponse(
    { id: appId, status: 'pending', character_name: body.name },
    'Character application submitted, awaiting admin approval'
  );
}

/**
 * 获取某书的角色申请列表 (管理员)
 */
async function handleListApplications(
  bookId: string,
  request: Request,
  env: CharacterEnv
): Promise<Response> {
  const auth = await requireAdmin(request, env.JWT_SECRET);

  const url = new URL(request.url);
  const status = url.searchParams.get('status') || 'pending';

  const result = await env.DB.prepare(`
    SELECT ca.*, u.username as applicant_name
    FROM character_applications ca
    JOIN users u ON ca.applicant_id = u.id
    WHERE ca.book_id = ? AND ca.status = ?
    ORDER BY ca.created_at DESC
  `).bind(bookId, status).all();

  return successResponse({
    book_id: bookId,
    applications: result.results,
  });
}

/**
 * 获取我的角色申请
 */
async function handleMyApplications(
  request: Request,
  env: CharacterEnv
): Promise<Response> {
  const auth = await requireAuth(request, env.JWT_SECRET);

  const result = await env.DB.prepare(`
    SELECT ca.*, b.title as book_title
    FROM character_applications ca
    JOIN books b ON ca.book_id = b.id
    WHERE ca.applicant_id = ?
    ORDER BY ca.created_at DESC
  `).bind(auth.userId).all();

  return successResponse({ applications: result.results });
}

/**
 * 管理员审批通过角色申请
 * → 将角色写入角色状态.md
 */
async function handleApprove(
  appId: string,
  request: Request,
  env: CharacterEnv
): Promise<Response> {
  const auth = await requireAdmin(request, env.JWT_SECRET);

  const app = await env.DB.prepare(
    `SELECT * FROM character_applications WHERE id = ? AND status = 'pending'`
  ).bind(appId).first<CharacterApplication>();

  if (!app) return notFoundError('Pending character application');

  const now = unixNow();

  // 更新申请状态
  await env.DB.prepare(`
    UPDATE character_applications
    SET status = 'approved', reviewed_by = ?, reviewed_at = ?
    WHERE id = ?
  `).bind(auth.userId, now, appId).run();

  // 读取当前角色状态文件
  const stateKey = CorePaths.characterState(app.book_id);
  const stateObj = await env.R2_CORE.get(stateKey);
  let stateContent = stateObj ? await stateObj.text() : '';

  // 追加新角色
  const charData: CharacterDetail = JSON.parse(app.character_data);
  const newCharEntry = generateCharacterMarkdown(charData);

  if (stateContent) {
    stateContent += '\n\n' + newCharEntry;
  } else {
    stateContent = '# 角色状态\n\n' + newCharEntry;
  }

  // 写回 R2
  await env.R2_CORE.put(stateKey, stateContent, {
    httpMetadata: { contentType: 'text/markdown' },
  });

  return successResponse(
    { id: appId, status: 'approved', character_name: app.character_name },
    'Character approved and added to the book'
  );
}

/**
 * 管理员拒绝角色申请
 */
async function handleReject(
  appId: string,
  request: Request,
  env: CharacterEnv
): Promise<Response> {
  const auth = await requireAdmin(request, env.JWT_SECRET);
  const body = await parseBody<{ reason?: string }>(request);

  const app = await env.DB.prepare(
    `SELECT * FROM character_applications WHERE id = ? AND status = 'pending'`
  ).bind(appId).first<CharacterApplication>();

  if (!app) return notFoundError('Pending character application');

  const now = unixNow();

  await env.DB.prepare(`
    UPDATE character_applications
    SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, review_note = ?
    WHERE id = ?
  `).bind(auth.userId, now, body.reason || 'Rejected by admin', appId).run();

  return successResponse({ id: appId, status: 'rejected' }, 'Character application rejected');
}

/**
 * 获取书中已批准的角色列表
 */
async function handleListCharacters(
  bookId: string,
  request: Request,
  env: CharacterEnv
): Promise<Response> {
  const auth = await requireAuth(request, env.JWT_SECRET);

  // 从R2读取角色状态文件
  const stateKey = CorePaths.characterState(bookId);
  const stateObj = await env.R2_CORE.get(stateKey);

  if (!stateObj) {
    return successResponse({ book_id: bookId, characters: [], raw_content: '' });
  }

  const content = await stateObj.text();
  return successResponse({ book_id: bookId, raw_content: content });
}

// ============================================
// 工具函数
// ============================================

function generateCharacterMarkdown(char: CharacterDetail): string {
  let md = `## ${char.name}\\n\\n`;
  md += `- **外貌**: ${char.appearance}\\n`;
  md += `- **性格**: ${char.personality}\\n`;
  md += `- **背景**: ${char.backstory}\\n`;
  md += `- **动机**: ${char.motivation}\\n`;
  if (char.abilities) md += `- **能力**: ${char.abilities}\\n`;
  if (char.relationship_to_existing) md += `- **与现有角色关系**: ${char.relationship_to_existing}\\n`;
  md += `- **弧光阶段**: setup (初始)\\n`;
  md += `- **当前状态**: 刚登场\\n`;
  md += `- **当前位置**: 待定\\n`;
  return md;
}

// ============================================
// Admin Email Action Handlers (token-based)
// ============================================

function actionSuccessHtml(title: string, message: string): Response {
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${title}</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f9fafb}
.card{background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.1);padding:40px;max-width:480px;text-align:center}
h1{color:#7c3aed;margin:0 0 16px}p{color:#374151;font-size:15px;line-height:1.6}</style></head>
<body><div class="card"><h1>AI Novel Platform</h1><p>${message}</p></div></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}

async function handleAdminApproveCharacter(id: string, url: URL, env: CharacterEnv): Promise<Response> {
  const token = url.searchParams.get('token');
  if (!token) return actionSuccessHtml('Error', 'Missing action token.');

  const valid = await verifyActionToken(id, 'approve', env.JWT_SECRET, token);
  if (!valid) return actionSuccessHtml('Error', 'Invalid or expired action token.');

  const app = await env.DB.prepare(
    `SELECT * FROM character_applications WHERE id = ? AND status = 'pending'`
  ).bind(id).first<CharacterApplication>();

  if (!app) return actionSuccessHtml('Not Found', 'Application not found or already processed.');

  const now = unixNow();

  await env.DB.prepare(`
    UPDATE character_applications
    SET status = 'approved', reviewed_at = ?
    WHERE id = ?
  `).bind(now, id).run();

  // Append character to R2 character state file
  const stateKey = CorePaths.characterState(app.book_id);
  const stateObj = await env.R2_CORE.get(stateKey);
  let stateContent = stateObj ? await stateObj.text() : '';

  const charData: CharacterDetail = JSON.parse(app.character_data);
  const newCharEntry = generateCharacterMarkdown(charData);

  if (stateContent) {
    stateContent += '\\n\\n' + newCharEntry;
  } else {
    stateContent = '# 角色状态\\n\\n' + newCharEntry;
  }

  await env.R2_CORE.put(stateKey, stateContent, {
    httpMetadata: { contentType: 'text/markdown' },
  });

  return actionSuccessHtml('Approved', `Character "${app.character_name}" has been approved and added to the book.`);
}

async function handleAdminRejectCharacter(id: string, url: URL, env: CharacterEnv): Promise<Response> {
  const token = url.searchParams.get('token');
  if (!token) return actionSuccessHtml('Error', 'Missing action token.');

  const valid = await verifyActionToken(id, 'reject', env.JWT_SECRET, token);
  if (!valid) return actionSuccessHtml('Error', 'Invalid or expired action token.');

  const app = await env.DB.prepare(
    `SELECT * FROM character_applications WHERE id = ? AND status = 'pending'`
  ).bind(id).first<CharacterApplication>();

  if (!app) return actionSuccessHtml('Not Found', 'Application not found or already processed.');

  const now = unixNow();
  await env.DB.prepare(`
    UPDATE character_applications
    SET status = 'rejected', reviewed_at = ?, review_note = 'Rejected via email action'
    WHERE id = ?
  `).bind(now, id).run();

  return actionSuccessHtml('Rejected', `Character application "${app.character_name}" has been rejected.`);
}
