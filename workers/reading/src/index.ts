import type { ReadingEnv, Book, Chapter, Direction } from '../../../shared/src/index';
import {
  successResponse, errorResponse, notFoundError,
  unauthorizedError, forbiddenError, corsResponse,
  optionalAuth, requireAuth, requireAdmin,
  CorePaths, ChapterPaths,
  KV_TTL,
  getBooksCacheVersion,
  bumpBooksCacheVersion,
} from '../../../shared/src/index';

export default {
  async fetch(request: Request, env: ReadingEnv): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    if (method === 'OPTIONS') return corsResponse();

    try {
      // ---- 书目相关 ----

      // GET /api/v1/books — 书目列表(公开)
      if (method === 'GET' && pathname === '/api/v1/books') {
        return await handleBookList(request, env);
      }

      // GET /api/v1/books/:id — 书目详情(公开)
      if (method === 'GET' && pathname.match(/^\/api\/v1\/books\/[^/]+$/) && !pathname.includes('/chapters')) {
        const bookId = pathname.split('/')[4];
        return await handleBookDetail(bookId, request, env);
      }

      // ---- 章节相关 ----

      // GET /api/v1/books/:bookId/chapters — 章节列表(目录)
      if (method === 'GET' && pathname.match(/^\/api\/v1\/books\/[^/]+\/chapters$/) && !pathname.includes('/directions')) {
        const bookId = pathname.split('/')[4];
        return await handleChapterList(bookId, request, env);
      }

      // GET /api/v1/books/:bookId/chapters/:num — 章节正文
      if (method === 'GET' && pathname.match(/^\/api\/v1\/books\/[^/]+\/chapters\/\d+$/)) {
        const parts = pathname.split('/');
        const bookId = parts[4];
        const chapterNum = parseInt(parts[6]);
        return await handleChapterRead(bookId, chapterNum, request, env);
      }

      // GET /api/v1/books/:bookId/chapters/:num/directions — 章节方向选项
      if (method === 'GET' && pathname.match(/^\/api\/v1\/books\/[^/]+\/chapters\/\d+\/directions$/)) {
        const parts = pathname.split('/');
        const bookId = parts[4];
        const chapterNum = parseInt(parts[6]);
        return await handleChapterDirections(bookId, chapterNum, request, env);
      }

      // ---- 核心文件(公开，用于展示) ----

      // GET /api/v1/books/:bookId/worldbuilding
      if (method === 'GET' && pathname.match(/^\/api\/v1\/books\/[^/]+\/worldbuilding$/)) {
        const bookId = pathname.split('/')[4];
        return await handleGetCoreFile(bookId, 'worldbuilding', env);
      }

      // GET /api/v1/books/:bookId/cover — 封面图片
      if (method === 'GET' && pathname.match(/^\/api\/v1\/books\/[^/]+\/cover$/)) {
        const bookId = pathname.split('/')[4];
        return await handleGetCover(bookId, env);
      }

      // DELETE /api/v1/admin/books/:id — Admin cascade delete
      if (method === 'DELETE' && pathname.match(/^\/api\/v1\/admin\/books\/[^/]+$/)) {
        const bookId = pathname.split('/')[5];
        return await handleAdminDeleteBook(bookId, request, env);
      }

      return notFoundError('Endpoint');

    } catch (err: any) {
      console.error('Reading Worker Error:', err);
      return errorResponse('Internal server error', 500);
    }
  },
};

// ============================================
// 处理函数
// ============================================

/**
 * 书目列表 — 公开
 */
async function handleBookList(request: Request, env: ReadingEnv): Promise<Response> {
  const url = new URL(request.url);
  const genre = url.searchParams.get('genre');
  const status = url.searchParams.get('status') || 'active';
  const sort = url.searchParams.get('sort') || 'updated_at';
  const lang = url.searchParams.get('lang');
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);
  const offset = (page - 1) * limit;
  const version = await getBooksCacheVersion(env.KV);
  const normalizedSort = sort === 'created_at' ? 'created_at' : sort === 'hot' ? 'hot' : 'updated_at';

  // 尝试从 KV 缓存读取
  const cacheKey = `books:v${version}:${status}:${genre || 'all'}:${lang || 'all'}:${normalizedSort}:${limit}:${page}`;
  const cached = await env.KV.get(cacheKey, 'json');
  if (cached) {
    return successResponse(cached);
  }

  let query = `SELECT id, title, genre, synopsis, status, current_chapter, total_words, created_at, updated_at FROM books WHERE status = ?`;
  const params: any[] = [status];

  if (genre) {
    query += ` AND genre = ?`;
    params.push(genre);
  }

  if (lang) {
    query += ` AND language = ?`;
    params.push(lang);
  }

  if (normalizedSort === 'created_at') {
    query += ` ORDER BY created_at DESC`;
  } else if (normalizedSort === 'hot') {
    query += ` ORDER BY current_chapter DESC, total_words DESC, updated_at DESC`;
  } else {
    query += ` ORDER BY updated_at DESC`;
  }
  query += ` LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const result = await env.DB.prepare(query).bind(...params).all();

  const data = {
    books: result.results,
    page,
    limit,
  };

  // 缓存到 KV
  await env.KV.put(cacheKey, JSON.stringify(data), {
    expirationTtl: KV_TTL.BOOK_LIST,
  });

  return successResponse(data);
}

/**
 * 书目详情 — 公开
 */
async function handleBookDetail(bookId: string, request: Request, env: ReadingEnv): Promise<Response> {
  const version = await getBooksCacheVersion(env.KV);
  // KV 缓存
  const cacheKey = `book:v${version}:${bookId}`;
  const cached = await env.KV.get(cacheKey, 'json');
  if (cached) return successResponse(cached);

  const book = await env.DB.prepare(`
    SELECT b.*, u.username as author_name
    FROM books b
    JOIN users u ON b.submitted_by = u.id
    WHERE b.id = ?
  `).bind(bookId).first<Book & { author_name: string }>();

  if (!book) return notFoundError('Book');

  // 获取最新章节信息
  const latestChapter = await env.DB.prepare(`
    SELECT chapter_number, title, published_at, word_count
    FROM chapters
    WHERE book_id = ? AND status = 'published'
    ORDER BY chapter_number DESC
    LIMIT 1
  `).bind(bookId).first();

  const data = {
    ...book,
    submission_data: JSON.parse(book.submission_data),
    latest_chapter: latestChapter || null,
  };

  await env.KV.put(cacheKey, JSON.stringify(data), {
    expirationTtl: KV_TTL.BOOK_LIST,
  });

  return successResponse(data);
}

/**
 * 章节列表(目录)
 */
async function handleChapterList(bookId: string, request: Request, env: ReadingEnv): Promise<Response> {
  const chapters = await env.DB.prepare(`
    SELECT chapter_number, title, word_count, published_at
    FROM chapters
    WHERE book_id = ? AND status = 'published'
    ORDER BY chapter_number
  `).bind(bookId).all();

  return successResponse({
    book_id: bookId,
    chapters: chapters.results,
    total: chapters.results.length,
  });
}

/**
 * 章节正文阅读
 */
async function handleChapterRead(
  bookId: string,
  chapterNum: number,
  request: Request,
  env: ReadingEnv
): Promise<Response> {
  // 查章节元数据
  const chapter = await env.DB.prepare(`
    SELECT * FROM chapters
    WHERE book_id = ? AND chapter_number = ? AND status = 'published'
  `).bind(bookId, chapterNum).first<Chapter>();

  if (!chapter) return notFoundError('Chapter');

  // 从 R2 读取正文
  const contentKey = ChapterPaths.content(bookId, chapterNum);
  const contentObj = await env.R2_CHAPTERS.get(contentKey);

  if (!contentObj) {
    return errorResponse('Chapter content not found in storage', 500);
  }

  const content = await contentObj.text();

  // 获取前情提要 (如果存在)
  let summary = '';
  if (chapter.r2_summary_key) {
    const summaryObj = await env.R2_CHAPTERS.get(chapter.r2_summary_key);
    if (summaryObj) summary = await summaryObj.text();
  }

  // 获取方向选项
  const directions = await env.DB.prepare(`
    SELECT id, direction_number, title, description, vote_count, status
    FROM directions
    WHERE chapter_id = ?
    ORDER BY direction_number
  `).bind(chapter.id).all();

  return successResponse({
    chapter: {
      number: chapter.chapter_number,
      title: chapter.title,
      word_count: chapter.word_count,
      published_at: chapter.published_at,
    },
    content,
    summary,
    directions: directions.results,
  });
}

/**
 * 章节方向选项
 */
async function handleChapterDirections(
  bookId: string,
  chapterNum: number,
  request: Request,
  env: ReadingEnv
): Promise<Response> {
  const chapter = await env.DB.prepare(`
    SELECT id FROM chapters
    WHERE book_id = ? AND chapter_number = ? AND status = 'published'
  `).bind(bookId, chapterNum).first<{ id: string }>();

  if (!chapter) return notFoundError('Chapter');

  const directions = await env.DB.prepare(`
    SELECT id, direction_number, title, description, vote_count, status
    FROM directions
    WHERE chapter_id = ?
    ORDER BY direction_number
  `).bind(chapter.id).all();

  return successResponse({
    chapter_number: chapterNum,
    directions: directions.results,
  });
}

/**
 * 读取核心文件
 */
async function handleGetCoreFile(
  bookId: string,
  fileType: 'worldbuilding' | 'plot-architecture' | 'character-state',
  env: ReadingEnv
): Promise<Response> {
  let key: string;
  switch (fileType) {
    case 'worldbuilding': key = CorePaths.worldbuilding(bookId); break;
    case 'plot-architecture': key = CorePaths.plotArchitecture(bookId); break;
    case 'character-state': key = CorePaths.characterState(bookId); break;
    default: return notFoundError('File type');
  }

  const obj = await env.R2_CORE.get(key);
  if (!obj) return notFoundError('File');

  const content = await obj.text();
  return successResponse({ book_id: bookId, type: fileType, content });
}

/**
 * 获取封面图片
 */
async function handleGetCover(bookId: string, env: ReadingEnv): Promise<Response> {
  const obj = await env.R2_CORE.get(`books/${bookId}/cover.png`);
  if (!obj) {
    // 返回默认封面
    return new Response(null, { status: 404 });
  }

  const contentType = obj.httpMetadata?.contentType || 'image/png';

  return new Response(obj.body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/**
 * Admin: Cascade delete a book and all related data
 */
async function handleAdminDeleteBook(bookId: string, request: Request, env: ReadingEnv): Promise<Response> {
  await requireAdmin(request, env.JWT_SECRET);

  // Check book exists
  const book = await env.DB.prepare(`SELECT id FROM books WHERE id = ?`).bind(bookId).first();
  if (!book) return notFoundError('Book');

  // Cascade delete: votes, directions, chapters, character_applications, then the book
  await env.DB.prepare(`DELETE FROM votes WHERE book_id = ?`).bind(bookId).run();
  await env.DB.prepare(`DELETE FROM directions WHERE book_id = ?`).bind(bookId).run();
  await env.DB.prepare(`DELETE FROM chapters WHERE book_id = ?`).bind(bookId).run();
  await env.DB.prepare(`DELETE FROM character_applications WHERE book_id = ?`).bind(bookId).run();
  await env.DB.prepare(`DELETE FROM books WHERE id = ?`).bind(bookId).run();
  await bumpBooksCacheVersion(env.KV);

  return successResponse({ id: bookId, deleted: true }, 'Book and all related data deleted');
}
