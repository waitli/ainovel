// ============================================
// 常量定义
// ============================================

/** 投票触发生成的门槛 (票数, 可通过 voting worker 的 VOTE_THRESHOLD 环境变量覆盖) */
export const VOTE_THRESHOLD = 1;

/** 每章生成的方向数量范围 */
export const DIRECTIONS_MIN = 2;
export const DIRECTIONS_MAX = 4;

/** 前情提要保留最近N章 */
export const SUMMARY_WINDOW = 30;

/** 每章目标字数范围 (兼容旧代码 — see ZH/EN variants in constants) */
export const CHAPTER_WORD_TARGET = { min: 2000, max: 4000 };

/** 章节状态 */
export const ChapterStatus = {
  GENERATING: 'generating',
  PUBLISHED: 'published',
  FAILED: 'failed',
} as const;

/** 书目状态 */
export const BookStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  PAUSED: 'paused',
} as const;

/** 角色申请状态 */
export const ApplicationStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

/** 用户角色 */
export const UserRole = {
  READER: 'reader',
  ADMIN: 'admin',
} as const;

/** 小说类型枚举 (中文) */
export const GENRES_ZH = [
  '玄幻', '仙侠', '科幻', '都市', '历史',
  '武侠', '悬疑', '奇幻', '言情', '军事', '游戏', '其他',
] as const;

/** 小说类型枚举 (英文) */
export const GENRES_EN = [
  'Fantasy', 'Sci-Fi', 'Romance', 'Thriller', 'Mystery',
  'Horror', 'Adventure', 'Historical', 'LitRPG', 'Urban', 'Other',
] as const;

/** 默认兼容: 使用中文类型 */
export const GENRES = GENRES_ZH;

/** 每章目标字数范围 (中文字符) */
export const CHAPTER_WORD_TARGET_ZH = { min: 2000, max: 4000 };

/** 每章目标字数范围 (英文单词) */
export const CHAPTER_WORD_TARGET_EN = { min: 1500, max: 3000 };

/** API路径前缀 */
export const API_PREFIX = '/api/v1';

/** 书籍缓存版本 KV key（用于主动失效） */
export const BOOKS_CACHE_VERSION_KEY = 'cache:books_version';

/** KV缓存TTL (秒) */
export const KV_TTL = {
  CHAPTER_CACHE: 3600,      // 章节缓存1小时
  BOOK_LIST: 300,            // 书目列表5分钟
  USER_SESSION: 86400,       // 用户会话24小时
} as const;
