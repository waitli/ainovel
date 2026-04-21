// ============================================
// R2 路径约定 — 统一管理所有存储路径
// ============================================

/**
 * R2桶A (R2_CORE) — 核心文件，低频更新
 * 结构: books/{book_id}/{filename}
 */
export const CorePaths = {
  /** 投稿原始数据 JSON */
  submission: (bookId: string) =>
    `books/${bookId}/submission.json`,

  /** 世界观.md */
  worldbuilding: (bookId: string) =>
    `books/${bookId}/worldbuilding.md`,

  /** 情节架构.md */
  plotArchitecture: (bookId: string) =>
    `books/${bookId}/plot-architecture.md`,

  /** 角色状态.md */
  characterState: (bookId: string) =>
    `books/${bookId}/character-state.md`,

  /** 列出某书的所有核心文件 */
  listAll: (bookId: string) =>
    `books/${bookId}/`,
} as const;

/**
 * R2桶B (R2_CHAPTERS) — 章节文件，高频追加
 * 结构: books/{book_id}/chapters/{chapter_number}/{filename}
 */
export const ChapterPaths = {
  /** 章节正文 */
  content: (bookId: string, chapterNum: number) =>
    `books/${bookId}/chapters/${chapterNum}/content.md`,

  /** 前情提要 */
  summary: (bookId: string, chapterNum: number) =>
    `books/${bookId}/chapters/${chapterNum}/summary.md`,

  /** 钩子/伏笔清单 */
  hooks: (bookId: string, chapterNum: number) =>
    `books/${bookId}/chapters/${chapterNum}/hooks.md`,

  /** 物品清单 */
  items: (bookId: string, chapterNum: number) =>
    `books/${bookId}/chapters/${chapterNum}/items.md`,

  /** 方向选项 JSON */
  directions: (bookId: string, chapterNum: number) =>
    `books/${bookId}/chapters/${chapterNum}/directions.json`,

  /** 章节元数据 JSON */
  meta: (bookId: string, chapterNum: number) =>
    `books/${bookId}/chapters/${chapterNum}/meta.json`,

  /** 列出某章所有文件 */
  listChapter: (bookId: string, chapterNum: number) =>
    `books/${bookId}/chapters/${chapterNum}/`,

  /** 列出某书所有章节 */
  listAllChapters: (bookId: string) =>
    `books/${bookId}/chapters/`,
} as const;
