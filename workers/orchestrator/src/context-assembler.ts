// ============================================
// 上下文拼装器 — 从R2拉取所有需要的文件，组装成完整上下文
// ============================================

import type { SummaryFile, HooksFile, ItemsFile, Direction } from '../../../shared/src/index';
import { CorePaths, ChapterPaths, SUMMARY_WINDOW } from '../../../shared/src/index';

export interface GenerationContext {
  // 核心三文件
  worldbuilding: string;
  plotArchitecture: string;
  characterState: string;

  // 最近30章前情提要
  recentSummaries: string;

  // 钩子/伏笔
  hooks: string;

  // 物品清单
  items: string;

  // 胜出的方向
  winningDirection: {
    title: string;
    description: string;
  } | null;

  // 投稿原始数据
  submission: string;

  // 当前章节号
  currentChapter: number;
  nextChapter: number;
}

/**
 * 从R2拼装完整的生成上下文
 */
export async function assembleContext(
  bookId: string,
  currentChapter: number,
  winningDirectionId: string | null,
  r2Core: R2Bucket,
  r2Chapters: R2Bucket,
  db: D1Database
): Promise<GenerationContext> {
  const nextChapter = currentChapter + 1;

  // 并行读取所有R2文件
  const [
    worldbuildingObj,
    plotObj,
    characterObj,
    hooksObj,
    itemsObj,
  ] = await Promise.all([
    r2Core.get(CorePaths.worldbuilding(bookId)),
    r2Core.get(CorePaths.plotArchitecture(bookId)),
    r2Core.get(CorePaths.characterState(bookId)),
    r2Chapters.get(ChapterPaths.hooks(bookId, currentChapter)),
    r2Chapters.get(ChapterPaths.items(bookId, currentChapter)),
  ]);

  const worldbuilding = worldbuildingObj ? await worldbuildingObj.text() : '';
  const plotArchitecture = plotObj ? await plotObj.text() : '';
  const characterState = characterObj ? await characterObj.text() : '';
  const hooks = hooksObj ? await hooksObj.text() : '';
  const items = itemsObj ? await itemsObj.text() : '';

  // 读取最近N章的前情提要
  const recentSummaries = await assembleRecentSummaries(
    bookId, currentChapter, r2Chapters
  );

  // 读取胜出的方向
  let winningDirection: { title: string; description: string } | null = null;
  if (winningDirectionId) {
    const dir = await db.prepare(
      `SELECT title, description FROM directions WHERE id = ?`
    ).bind(winningDirectionId).first<{ title: string; description: string }>();
    winningDirection = dir || null;
  }

  // 读取投稿原始数据
  const submissionObj = await r2Core.get(CorePaths.submission(bookId));
  const submission = submissionObj ? await submissionObj.text() : '';

  return {
    worldbuilding,
    plotArchitecture,
    characterState,
    recentSummaries,
    hooks,
    items,
    winningDirection,
    submission,
    currentChapter,
    nextChapter,
  };
}

/**
 * 拼装最近N章的前情提要
 */
async function assembleRecentSummaries(
  bookId: string,
  currentChapter: number,
  r2Chapters: R2Bucket
): Promise<string> {
  const startChapter = Math.max(1, currentChapter - SUMMARY_WINDOW + 1);
  const summaries: string[] = [];

  // 并行读取所有提要
  const promises: Promise<void>[] = [];
  for (let i = startChapter; i <= currentChapter; i++) {
    promises.push(
      r2Chapters.get(ChapterPaths.summary(bookId, i))
        .then(async (obj) => {
          if (obj) {
            const text = await obj.text();
            summaries.push(text);
          }
        })
    );
  }
  await Promise.all(promises);

  if (summaries.length === 0) {
    return '(暂无前情提要，这是第一个章节)';
  }

  return summaries.join('\n\n---\n\n');
}
