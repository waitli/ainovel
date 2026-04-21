import type { VotingEnv, Direction, Vote } from '../../../shared/src/index';
import {
  generateId, unixNow,
  successResponse, errorResponse, notFoundError,
  unauthorizedError, forbiddenError, corsResponse,
  parseBody, d1FirstRow,
  requireAuth, requireAdmin,
  VOTE_THRESHOLD,
} from '../../../shared/src/index';

// 导出 Durable Object
export { VoteCounter } from './vote-counter';

export default {
  async fetch(request: Request, env: VotingEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    if (method === 'OPTIONS') return corsResponse();

    try {
      // POST /api/v1/votes — 投票
      if (method === 'POST' && pathname === '/api/v1/votes') {
        return await handleVote(request, env, ctx);
      }

      // GET /api/v1/chapters/:chapterId/directions — 获取某章的方向选项+票数
      if (method === 'GET' && pathname.match(/^\/api\/v1\/chapters\/[^/]+\/directions$/)) {
        const chapterId = pathname.split('/')[4];
        return await handleGetDirections(chapterId, request, env);
      }

      // GET /api/v1/chapters/:chapterId/votes/status — 投票状态(实时)
      if (method === 'GET' && pathname.match(/^\/api\/v1\/chapters\/[^/]+\/votes\/status$/)) {
        const chapterId = pathname.split('/')[4];
        return await handleVoteStatus(chapterId, request, env);
      }

      // POST /api/v1/books/:bookId/chapters/:chapterNum/directions — (管理员)创建方向选项
      if (method === 'POST' && pathname.match(/^\/api\/v1\/books\/[^/]+\/chapters\/[^/]+\/directions$/)) {
        const parts = pathname.split('/');
        const bookId = parts[3];
        const chapterNum = parseInt(parts[5]);
        return await handleCreateDirections(bookId, chapterNum, request, env);
      }

      return notFoundError('Endpoint');

    } catch (err: any) {
      if (err.message === 'UNAUTHORIZED') return unauthorizedError();
      if (err.message === 'FORBIDDEN') return forbiddenError();
      console.error('Voting Worker Error:', err);
      return errorResponse('Internal server error', 500);
    }
  },
};

// ============================================
// 处理函数
// ============================================

/**
 * 读者投票
 */
async function handleVote(request: Request, env: VotingEnv, ctx: ExecutionContext): Promise<Response> {
  const auth = await requireAuth(request, env.JWT_SECRET);
  if (auth.isAdmin) return errorResponse('Admin accounts cannot vote', 403);
  const body = await parseBody<{ direction_id: string }>(request);

  if (!body.direction_id) {
    return errorResponse('direction_id is required');
  }

  const threshold = parseInt(env.VOTE_THRESHOLD || `${VOTE_THRESHOLD}`, 10) || VOTE_THRESHOLD;



  // 查方向选项
  const direction = await env.DB.prepare(
    `SELECT d.*, c.id as chapter_id, c.book_id, c.status as chapter_status
     FROM directions d
     JOIN chapters c ON d.chapter_id = c.id
     WHERE d.id = ? AND d.status = 'voting'`
  ).bind(body.direction_id).first<Direction & { chapter_status: string; book_id: string }>();

  if (!direction) {
    return errorResponse('Direction not found or voting closed');
  }

  if (direction.chapter_status !== 'published') {
    return errorResponse('Chapter not yet published');
  }

  // 检查用户是否已在此章节投票
  const existingVote = await env.DB.prepare(
    `SELECT id FROM votes WHERE user_id = ? AND chapter_id = ?`
  ).bind(auth.userId, direction.chapter_id).first();

  if (existingVote) {
    return errorResponse('You have already voted on this chapter');
  }

  const voteId = generateId();
  const now = unixNow();

  // 1. 写入投票记录 (D1)
  await env.DB.prepare(`
    INSERT INTO votes (id, user_id, direction_id, chapter_id, book_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(voteId, auth.userId, body.direction_id, direction.chapter_id, direction.book_id, now).run();

  // 2. 更新方向票数 (D1)
  await env.DB.prepare(`
    UPDATE directions SET vote_count = vote_count + 1 WHERE id = ?
  `).bind(body.direction_id).run();

  // 3. Durable Object 实时计数 (防并发)
  const doId = env.VOTE_COUNTER.idFromName(direction.chapter_id);
  const stub = env.VOTE_COUNTER.get(doId);

  const doResponse = await stub.fetch(new Request('https://do/vote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: auth.userId,
      direction_id: body.direction_id,
    }),
  }));

  const doResult = await doResponse.json() as any;

  // 4. 如果投票达标 → 入队触发下一章生成
  if (doResult.should_trigger) {
    // 标记胜出方向
    await env.DB.prepare(`
      UPDATE directions SET status = 'won' WHERE id = ?
    `).bind(doResult.winning_direction).run();

    // 标记其他方向为 lost
    await env.DB.prepare(`
      UPDATE directions SET status = 'lost'
      WHERE chapter_id = ? AND id != ?
    `).bind(direction.chapter_id, doResult.winning_direction).run();

    // 发送到 Queue → orchestrator consumer 自动处理
    await env.CHAPTER_QUEUE.send({
      type: 'GENERATE_NEXT_CHAPTER',
      book_id: direction.book_id,
      chapter_id: direction.chapter_id,
      winning_direction_id: doResult.winning_direction,
    });

    return successResponse({
      vote_id: voteId,
      triggered: true,
      winning_direction: doResult.winning_direction,
    }, 'Vote recorded. Next chapter generation triggered!');
  }

  return successResponse({
    vote_id: voteId,
    triggered: false,
    current_votes: doResult.state?.direction_counts[body.direction_id] || 0,
    threshold,
  }, 'Vote recorded');
}

/**
 * 获取章节的方向选项 + 票数
 */
async function handleGetDirections(
  chapterId: string,
  request: Request,
  env: VotingEnv
): Promise<Response> {
  const auth = await requireAuth(request, env.JWT_SECRET);

  const directions = await env.DB.prepare(
    `SELECT * FROM directions WHERE chapter_id = ? ORDER BY direction_number`
  ).bind(chapterId).all<Direction>();

  return successResponse({
    chapter_id: chapterId,
    directions: directions.results,
  });
}

/**
 * 获取投票实时状态 (从 DO 读取)
 */
async function handleVoteStatus(
  chapterId: string,
  request: Request,
  env: VotingEnv
): Promise<Response> {
  const auth = await requireAuth(request, env.JWT_SECRET);

  const doId = env.VOTE_COUNTER.idFromName(chapterId);
  const stub = env.VOTE_COUNTER.get(doId);

  const doResponse = await stub.fetch(new Request('https://do/status'));
  const result = await doResponse.json();

  return successResponse(result);
}

/**
 * 管理员创建方向选项 (在章节发布后调用)
 */
async function handleCreateDirections(
  bookId: string,
  chapterNum: number,
  request: Request,
  env: VotingEnv
): Promise<Response> {
  const auth = await requireAdmin(request, env.JWT_SECRET);
  const body = await parseBody<{
    directions: { title: string; description: string }[]
  }>(request);

  if (!body.directions || body.directions.length < 2 || body.directions.length > 4) {
    return errorResponse('Must provide 2-4 directions');
  }

  // 获取章节
  const chapter = await env.DB.prepare(
    `SELECT * FROM chapters WHERE book_id = ? AND chapter_number = ?`
  ).bind(bookId, chapterNum).first<{ id: string; status: string }>();

  if (!chapter) return notFoundError('Chapter');
  if (chapter.status !== 'published') {
    return errorResponse('Chapter must be published before adding directions');
  }

  // 删除旧方向 (如果有)
  await env.DB.prepare(
    `DELETE FROM directions WHERE chapter_id = ?`
  ).bind(chapter.id).run();

  // 创建新方向
  const directionIds: string[] = [];
  for (let i = 0; i < body.directions.length; i++) {
    const dir = body.directions[i];
    const dirId = generateId();
    directionIds.push(dirId);

    await env.DB.prepare(`
      INSERT INTO directions (id, chapter_id, book_id, direction_number, title, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(dirId, chapter.id, bookId, i + 1, dir.title, dir.description, unixNow()).run();
  }

  // 初始化 Durable Object 投票计数器
  const threshold = parseInt(env.VOTE_THRESHOLD || '3');
  const doId = env.VOTE_COUNTER.idFromName(chapter.id);
  const stub = env.VOTE_COUNTER.get(doId);

  await stub.fetch(new Request('https://do/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chapter_id: chapter.id,
      book_id: bookId,
      direction_ids: directionIds,
      threshold,
    }),
  }));

  return successResponse({
    chapter_id: chapter.id,
    directions_count: directionIds.length,
    threshold,
  }, 'Directions created and voting opened');
}
