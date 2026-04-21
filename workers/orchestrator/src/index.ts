import type { OrchestratorEnv, Book, Chapter } from '../../../shared/src/index';
import {
  generateId, unixNow,
  successResponse, errorResponse, corsResponse,
  CorePaths, ChapterPaths,
  BookStatus, ChapterStatus,
  DIRECTIONS_MIN, DIRECTIONS_MAX,
  bumpBooksCacheVersion,
} from '../../../shared/src/index';
import { assembleContext } from './context-assembler';
import { buildChapterPrompt, buildInitPrompt, buildPostProcessPrompt } from './prompt-builder';
import { generateChapter, generateCoreFiles, postProcessChapter, getAIConfig } from './ai-caller';
import { indexCharacter, indexWorldRule, indexHook, indexItem, indexPlotEvent, getConsistencyContext, indexChapterContent } from './vector-service';
import { generateCover } from './cover-generator';

// Default fallback direction titles
const DIRECTION_TITLES_ZH = [
  { title: '激进路线', description: '角色采取大胆行动，直接面对冲突核心' },
  { title: '迂回路线', description: '角色选择暂时退避，寻找更稳妥的破局方式' },
  { title: '意外转折', description: '突如其来的变故打破了原有计划，迫使所有人重新调整策略' },
];

const DIRECTION_TITLES_EN = [
  { title: 'Bold Path', description: 'The character takes daring action, confronting the core conflict head-on' },
  { title: 'Cautious Route', description: 'The character chooses to step back temporarily, seeking a safer way to break the deadlock' },
  { title: 'Unexpected Twist', description: 'A sudden turn of events shatters the original plan, forcing everyone to readjust their strategy' },
];

// Direction section markers
const DIRECTION_MARKER_ZH = '## 后续发展方向';
const DIRECTION_MARKER_EN = '## What Happens Next?';

export default {
  /**
   * HTTP 入口 (手动触发/管理接口)
   */
  async fetch(request: Request, env: OrchestratorEnv): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    if (method === 'OPTIONS') return corsResponse();

    try {
      // POST /init-book — 直接触发初始化 (绕过 Queue)
      if (method === 'POST' && url.pathname === '/init-book') {
        const body = await request.json() as any;
        console.log(`[HTTP] Received init-book for ${body.book_id}`);
        await handleInitBook(body, env);
        return successResponse({ status: 'completed' }, 'Book initialized');
      }

      // POST /generate-chapter — 直接触发下一章生成
      if (method === 'POST' && url.pathname === '/generate-chapter') {
        const body = await request.json() as any;
        console.log(`[HTTP] Received generate-chapter for ${body.book_id}`);
        await handleGenerateNextChapter(body, env);
        return successResponse({ status: 'completed' }, 'Chapter generated');
      }

      // GET /health — 健康检查
      if (url.pathname === '/health') {
        return successResponse({ status: 'ok', timestamp: unixNow() });
      }

      return errorResponse('Not found', 404);

    } catch (err: any) {
      console.error('Orchestrator HTTP Error:', err.message, err.stack);
      return errorResponse(`Orchestrator error: ${err.message}`, 500);
    }
  },

  /**
   * Queue 消费者 — 处理章节生成任务
   * 这是核心入口，所有生成任务都从这里进来
   */
  async queue(batch: MessageBatch<any>, env: OrchestratorEnv, ctx: ExecutionContext): Promise<void> {
    console.log(`[QUEUE] Received ${batch.messages.length} messages, queue: ${batch.queue}`);
    for (const message of batch.messages) {
      try {
        const task = message.body;
        console.log(`[QUEUE] Processing task type: ${task.type}, book_id: ${task.book_id}`);

        switch (task.type) {
          case 'INIT_BOOK':
            console.log(`[QUEUE] Starting INIT_BOOK for ${task.book_id}`);
            await handleInitBook(task, env);
            console.log(`[QUEUE] INIT_BOOK completed for ${task.book_id}`);
            break;

          case 'GENERATE_NEXT_CHAPTER':
            console.log(`[QUEUE] Starting GENERATE_NEXT_CHAPTER for ${task.book_id}`);
            await handleGenerateNextChapter(task, env);
            console.log(`[QUEUE] GENERATE_NEXT_CHAPTER completed for ${task.book_id}`);
            break;

          default:
            console.error('[QUEUE] Unknown task type:', task.type);
        }

        message.ack();
        console.log(`[QUEUE] Message acked`);
      } catch (err: any) {
        console.error('[QUEUE] Processing error:', err.message, err.stack);
        message.retry();
      }
    }
  },

  /**
   * Cron 触发 — 定时检查投票是否达标 (备用机制)
   */
  async scheduled(event: ScheduledEvent, env: OrchestratorEnv, ctx: ExecutionContext): Promise<void> {
    try {
      await checkVotingThresholds(env);
    } catch (err) {
      console.error('Cron check error:', err);
    }
  },
};

// ============================================
// 核心处理函数
// ============================================

/**
 * 初始化新书 — 审批通过后触发
 * 1. 生成三个核心 md 文件
 * 2. 生成第一章
 * 3. 生成方向选项
 * 4. 更新书目状态为 active
 */
async function handleInitBook(task: any, env: OrchestratorEnv): Promise<void> {
  const { book_id, submission } = task;
  const language: 'zh' | 'en' = submission.language || 'zh';
  console.log(`[INIT_BOOK] Starting book ${book_id}: ${submission.title} (lang: ${language})`);

  const aiConfig = getAIConfig(env);

  // 单次 AI 调用：生成核心文件 + 第一章 (合并以适应 30s 限制)
  const initPrompt = buildInitPrompt(submission, language);
  const initResponse = await generateCoreFiles(initPrompt, aiConfig, undefined, language);

  // 解析核心文件
  const files = parseInitFiles(initResponse.content);

  // 写入 R2 桶A (核心文件)
  await Promise.all([
    env.R2_CORE.put(CorePaths.worldbuilding(book_id), files.worldbuilding, {
      httpMetadata: { contentType: 'text/markdown' },
    }),
    env.R2_CORE.put(CorePaths.plotArchitecture(book_id), files.plotArchitecture, {
      httpMetadata: { contentType: 'text/markdown' },
    }),
    env.R2_CORE.put(CorePaths.characterState(book_id), files.characterState, {
      httpMetadata: { contentType: 'text/markdown' },
    }),
  ]);
  console.log(`[INIT_BOOK] Core files saved for ${book_id}`);

  // 用已有的核心文件 + 投稿数据拼装章节上下文
  const ctx = await assembleContext(book_id, 0, null, env.R2_CORE, env.R2_CHAPTERS, env.DB);
  const chapterPrompt = buildChapterPrompt(ctx, language);
  const chapterResponse = await generateChapter(chapterPrompt, aiConfig, undefined, language);

  // 解析章节内容和方向选项
  const { content: chapterContent, directions } = parseChapterOutput(chapterResponse.content, 1, language);

  // 存储第一章到 R2 桶B
  const chapterId = generateId();
  const contentKey = ChapterPaths.content(book_id, 1);
  const directionsKey = ChapterPaths.directions(book_id, 1);

  await Promise.all([
    env.R2_CHAPTERS.put(contentKey, chapterContent, {
      httpMetadata: { contentType: 'text/markdown' },
    }),
    env.R2_CHAPTERS.put(directionsKey, JSON.stringify({
      chapter_number: 1, directions,
    }, null, 2), {
      httpMetadata: { contentType: 'application/json' },
    }),
  ]);

  // 生成简单摘要 (不调 AI，直接用章节前200字)
  const simpleSummary = chapterContent.slice(0, 200).replace(/^#.*\n/, '').trim();
  const summaryLabel = language === 'en' ? 'Chapter 1 Summary' : '第1章摘要';
  await env.R2_CHAPTERS.put(ChapterPaths.summary(book_id, 1), `${summaryLabel}:\n${simpleSummary}...`, {
    httpMetadata: { contentType: 'text/markdown' },
  });

  // 写入 D1
  const now = unixNow();
  const defaultTitle = language === 'en' ? 'Chapter 1' : '第1章';

  await env.DB.prepare(`
    INSERT INTO chapters (id, book_id, chapter_number, title, r2_content_key, r2_summary_key, r2_hooks_key, r2_items_key, r2_directions_key, status, word_count, created_at, published_at)
    VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?)
  `).bind(
    chapterId, book_id,
    extractTitle(chapterContent, language) || defaultTitle,
    contentKey,
    ChapterPaths.summary(book_id, 1),
    ChapterPaths.hooks(book_id, 1),
    ChapterPaths.items(book_id, 1),
    directionsKey,
    chapterContent.length, now, now
  ).run();

  for (let i = 0; i < directions.length; i++) {
    await env.DB.prepare(`
      INSERT INTO directions (id, chapter_id, book_id, direction_number, title, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(generateId(), chapterId, book_id, i + 1, directions[i].title, directions[i].description, now).run();
  }

  // 生成简介：worldview + outline
  const synopsis = [submission.worldview, submission.outline].filter(Boolean).join(' ');

  // 更新书目状态 (多次尝试以防 D1 超时)
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await env.DB.prepare(`
        UPDATE books SET status = 'active', current_chapter = 1, total_words = ?, updated_at = ?, language = ?, synopsis = COALESCE(synopsis, ?) WHERE id = ?
      `).bind(chapterContent.length, now, language, synopsis, book_id).run();
      await bumpBooksCacheVersion(env.KV);
      break;
    } catch (e: any) {
      console.error(`[INIT_BOOK] Book status update attempt ${attempt + 1} failed: ${e.message}`);
      if (attempt === 2) console.error(`[INIT_BOOK] All attempts failed for book status update: ${book_id}`);
    }
  }

  console.log(`[INIT_BOOK] Done: ${book_id}, ch1=${chapterContent.length}, ${directions.length} directions, lang=${language}`);

  // 向量索引: 存储角色和世界观的 embedding
  try {
    console.log(`[VECTOR] Starting indexing for ${book_id}`);
    const sub = task.submission;
    if (sub.characters) {
      for (const c of sub.characters) {
        console.log(`[VECTOR] Indexing character: ${c.name}`);
        await indexCharacter(book_id, c.name, `${c.personality} ${c.appearance} ${c.motivation} ${c.backstory}`, 1, env.AI, env.VECTORIZE, language);
      }
    }
    if (files.worldbuilding) {
      console.log(`[VECTOR] Indexing world rules`);
      const ruleName = language === 'en' ? 'Worldbuilding' : '世界观';
      await indexWorldRule(book_id, ruleName, files.worldbuilding.slice(0, 500), env.AI, env.VECTORIZE, language);
    }
    console.log(`[VECTOR] Indexed successfully for ${book_id}`);
  } catch (e: any) {
    console.error(`[VECTOR] Indexing error: ${e.message}`, e.stack);
  }

  // AI 生成封面图片
  try {
    const sub = task.submission;
    console.log(`[COVER] Generating cover for: ${sub.title}`);
    const cover = await generateCover(
      sub.title,
      sub.genre,
      sub.worldview || sub.outline || '',
      {
        apiKey: env.COVER_API_KEY || env.AI_API_KEY,
        baseUrl: env.COVER_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3/images/generations',
        model: env.COVER_MODEL || 'doubao-seedream-4-5-251128',
        size: env.COVER_SIZE || '2K',
        watermark: env.COVER_WATERMARK ? env.COVER_WATERMARK === 'true' : true,
        responseFormat: env.COVER_RESPONSE_FORMAT === 'b64_json' ? 'b64_json' : 'url',
      },
    );

    if (cover) {
      await env.R2_CORE.put(`books/${book_id}/cover.png`, cover.buffer, {
        httpMetadata: { contentType: cover.contentType || 'image/png' },
      });
      // 更新书目封面路径
      await env.DB.prepare(`UPDATE books SET synopsis = COALESCE(synopsis, '') || '' WHERE id = ?`).bind(book_id).run();
      console.log(`[COVER] Cover saved: ${cover.buffer.length} bytes, type=${cover.contentType}`);
    } else {
      console.log(`[COVER] No image generated, using fallback`);
    }
  } catch (e: any) {
    console.error(`[COVER] Error: ${e.message}`);
  }
}

/**
 * 生成下一章 — 投票达标后触发
 */
async function handleGenerateNextChapter(task: any, env: OrchestratorEnv): Promise<void> {
  const { book_id, chapter_id, winning_direction_id } = task;

  // 获取当前章节数 + language
  const book = await env.DB.prepare(
    `SELECT current_chapter, title, language FROM books WHERE id = ?`
  ).bind(book_id).first<{ current_chapter: number; title: string; language?: string }>();

  if (!book) {
    console.error(`[GENERATE] Book ${book_id} not found`);
    return;
  }

  const language: 'zh' | 'en' = (book.language as 'zh' | 'en') || 'zh';
  const currentChapter = book.current_chapter;
  const nextChapter = currentChapter + 1;

  console.log(`[GENERATE] Book "${book.title}": generating chapter ${nextChapter} (lang: ${language})`);

  const aiConfig = getAIConfig(env);

  // 拼装上下文
  const ctx = await assembleContext(
    book_id, currentChapter, winning_direction_id,
    env.R2_CORE, env.R2_CHAPTERS, env.DB
  );

  // 向量搜索: 获取一致性上下文 (角色/规则/伏笔/物品)
  let consistencyContext = '';
  try {
    const outline = ctx.winningDirection?.description || ctx.plotArchitecture?.slice(0, 200) || '';
    consistencyContext = await getConsistencyContext(book_id, outline, env.AI, env.VECTORIZE, language);
    if (consistencyContext) {
      console.log(`[VECTOR] Found consistency context: ${consistencyContext.length} chars`);
    }
  } catch (e: any) {
    console.error(`[VECTOR] Search error: ${e.message}`);
  }

  // 生成章节 (带一致性上下文)
  const prompt = buildChapterPrompt(ctx, language);
  const response = await generateChapter(prompt, aiConfig, consistencyContext, language);

  // 解析输出
  const { content: chapterContent, directions } = parseChapterOutput(response.content, nextChapter, language);

  // 存储章节
  const chapterId = generateId();
  const contentKey = ChapterPaths.content(book_id, nextChapter);
  const directionsKey = ChapterPaths.directions(book_id, nextChapter);

  await Promise.all([
    env.R2_CHAPTERS.put(contentKey, chapterContent, {
      httpMetadata: { contentType: 'text/markdown' },
    }),
    env.R2_CHAPTERS.put(directionsKey, JSON.stringify({
      chapter_number: nextChapter,
      directions,
    }, null, 2), {
      httpMetadata: { contentType: 'application/json' },
    }),
  ]);

  // 后处理
  await postProcess(chapterContent, nextChapter, book_id, ctx, aiConfig, env, language);

  // 写入 D1
  const now = unixNow();
  const defaultTitle = language === 'en' ? `Chapter ${nextChapter}` : `第${nextChapter}章`;

  await env.DB.prepare(`
    INSERT INTO chapters (id, book_id, chapter_number, title, r2_content_key, r2_summary_key, r2_hooks_key, r2_items_key, r2_directions_key, status, word_count, created_at, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?)
  `).bind(
    chapterId,
    book_id,
    nextChapter,
    extractTitle(chapterContent, language) || defaultTitle,
    contentKey,
    ChapterPaths.summary(book_id, nextChapter),
    ChapterPaths.hooks(book_id, nextChapter),
    ChapterPaths.items(book_id, nextChapter),
    directionsKey,
    chapterContent.length,
    now,
    now
  ).run();

  // 方向选项
  for (let i = 0; i < directions.length; i++) {
    const dir = directions[i];
    await env.DB.prepare(`
      INSERT INTO directions (id, chapter_id, book_id, direction_number, title, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      generateId(),
      chapterId,
      book_id,
      i + 1,
      dir.title,
      dir.description,
      now
    ).run();
  }

  // 更新书目
  await env.DB.prepare(`
    UPDATE books SET current_chapter = ?, total_words = total_words + ?, updated_at = ? WHERE id = ?
  `).bind(nextChapter, chapterContent.length, now, book_id).run();
  await bumpBooksCacheVersion(env.KV);

  // 更新上一章的方向状态
  await env.DB.prepare(`
    UPDATE directions SET status = 'won' WHERE id = ?
  `).bind(winning_direction_id).run();

  await env.DB.prepare(`
    UPDATE directions SET status = 'lost' WHERE chapter_id = ? AND id != ? AND status = 'voting'
  `).bind(chapter_id, winning_direction_id).run();

  // 标记上一章的胜出方向
  await env.DB.prepare(`
    UPDATE chapters SET winning_direction_id = ? WHERE id = ?
  `).bind(winning_direction_id, chapter_id).run();

  console.log(`[GENERATE] Chapter ${nextChapter} published for "${book.title}"`);

  // 向量索引: 存储本章情节事件和新物品
  try {
    // 索引本章关键情节
    const summary = chapterContent.slice(0, 300).replace(/\n/g, ' ');
    await indexPlotEvent(book_id, `ch${nextChapter}`, summary, nextChapter, env.AI, env.VECTORIZE, language);
    console.log(`[VECTOR] Indexed plot event for chapter ${nextChapter}`);
  } catch (e: any) {
    console.error(`[VECTOR] Indexing error: ${e.message}`);
  }
}

/**
 * 定时检查投票是否达标 (备用触发机制)
 */
async function checkVotingThresholds(env: OrchestratorEnv): Promise<void> {
  // 查找所有有活跃投票的章节
  const activeChapters = await env.DB.prepare(`
    SELECT c.id as chapter_id, c.book_id, c.chapter_number, b.title as book_title
    FROM chapters c
    JOIN books b ON c.book_id = b.id
    WHERE c.status = 'published'
    AND c.winning_direction_id IS NULL
    AND EXISTS (
      SELECT 1 FROM directions d
      WHERE d.chapter_id = c.id AND d.status = 'voting'
    )
    ORDER BY c.created_at DESC
    LIMIT 50
  `).all();

  for (const chapter of activeChapters.results as any[]) {
    // 检查每个方向的票数
    const directions = await env.DB.prepare(`
      SELECT id, vote_count FROM directions
      WHERE chapter_id = ? AND status = 'voting'
      ORDER BY vote_count DESC
    `).bind(chapter.chapter_id).all();

    for (const dir of directions.results as any[]) {
      if (dir.vote_count >= 3) { // 阈值
        // 触发生成
        await env.CHAPTER_QUEUE.send({
          type: 'GENERATE_NEXT_CHAPTER',
          book_id: chapter.book_id,
          chapter_id: chapter.chapter_id,
          winning_direction_id: dir.id,
        });

        console.log(`[CRON] Triggered generation for "${chapter.book_title}" chapter ${chapter.chapter_number + 1}`);
        break;
      }
    }
  }
}

// ============================================
// 后处理
// ============================================

async function postProcess(
  chapterContent: string,
  chapterNumber: number,
  bookId: string,
  ctx: any,
  aiConfig: any,
  env: OrchestratorEnv,
  language: 'zh' | 'en' = 'zh'
): Promise<void> {
  try {
    const postPrompt = buildPostProcessPrompt(chapterContent, chapterNumber, ctx, language);
    const postResponse = await postProcessChapter(postPrompt, aiConfig, undefined, language);

    const { summary, hooks, items } = parsePostProcessOutput(postResponse.content);

    await Promise.all([
      env.R2_CHAPTERS.put(ChapterPaths.summary(bookId, chapterNumber), summary, {
        httpMetadata: { contentType: 'text/markdown' },
      }),
      env.R2_CHAPTERS.put(ChapterPaths.hooks(bookId, chapterNumber), hooks, {
        httpMetadata: { contentType: 'text/markdown' },
      }),
      env.R2_CHAPTERS.put(ChapterPaths.items(bookId, chapterNumber), items, {
        httpMetadata: { contentType: 'text/markdown' },
      }),
    ]);

    console.log(`[POST] Summary/hooks/items generated for chapter ${chapterNumber}`);
  } catch (err) {
    console.error(`[POST] Post-processing failed for chapter ${chapterNumber}:`, err);
    // 后处理失败不影响章节发布
  }
}

// ============================================
// 解析工具函数
// ============================================

function parseInitFiles(content: string): {
  worldbuilding: string;
  plotArchitecture: string;
  characterState: string;
} {
  const worldMatch = content.match(/===FILE:worldbuilding===\s*([\s\S]*?)(?===FILE:|$)/);
  const plotMatch = content.match(/===FILE:plot-architecture===\s*([\s\S]*?)(?===FILE:|$)/);
  const charMatch = content.match(/===FILE:character-state===\s*([\s\S]*?)(?===FILE:|$)/);

  return {
    worldbuilding: worldMatch?.[1]?.trim() || content.substring(0, content.length / 3),
    plotArchitecture: plotMatch?.[1]?.trim() || content.substring(content.length / 3, content.length * 2 / 3),
    characterState: charMatch?.[1]?.trim() || content.substring(content.length * 2 / 3),
  };
}

function parseChapterOutput(content: string, chapterNumber: number, language: 'zh' | 'en' = 'zh'): {
  content: string;
  directions: { title: string; description: string }[];
} {
  // Direction section markers by language
  const directionMarker = language === 'en' ? DIRECTION_MARKER_EN : DIRECTION_MARKER_ZH;
  const markerIndex = content.indexOf(directionMarker);

  let chapterContent = content;
  const directions: { title: string; description: string }[] = [];

  if (markerIndex > 0) {
    chapterContent = content.substring(0, markerIndex).trim();

    // 解析方向选项
    const directionSection = content.substring(markerIndex);

    // Regex differs by language: EN uses "Option A/B/C/D", ZH uses "方向A/B/C/D"
    const directionRegex = language === 'en'
      ? /Option\s+([A-D])\s*:\s*(.+?)\n([\s\S]*?)(?=Option\s+[A-D]|$)/g
      : /方向([A-D])\s*:\s*(.+?)\n([\s\S]*?)(?=方向[A-D]|$)/g;

    let match;
    while ((match = directionRegex.exec(directionSection)) !== null) {
      const title = match[2].trim();
      const desc = match[3].trim().split('\n')[0]; // 取第一行作为描述
      if (title && desc) {
        directions.push({ title, description: desc });
      }
    }
  }

  // 如果没解析到方向，生成默认的
  if (directions.length < DIRECTIONS_MIN) {
    const fallback = language === 'en' ? DIRECTION_TITLES_EN : DIRECTION_TITLES_ZH;
    for (const d of fallback) {
      directions.push({ ...d });
    }
  }

  return { content: chapterContent, directions: directions.slice(0, DIRECTIONS_MAX) };
}

function parsePostProcessOutput(content: string): {
  summary: string;
  hooks: string;
  items: string;
} {
  const summaryMatch = content.match(/===FILE:summary===\s*([\s\S]*?)(?===FILE:|$)/);
  const hooksMatch = content.match(/===FILE:hooks===\s*([\s\S]*?)(?===FILE:|$)/);
  const itemsMatch = content.match(/===FILE:items===\s*([\s\S]*?)(?===FILE:|$)/);

  return {
    summary: summaryMatch?.[1]?.trim() || '',
    hooks: hooksMatch?.[1]?.trim() || '',
    items: itemsMatch?.[1]?.trim() || '',
  };
}

function extractTitle(content: string, language: 'zh' | 'en' = 'zh'): string | null {
  const match = content.match(/^#\s*(.+)$/m);
  return match?.[1]?.trim() || null;
}
