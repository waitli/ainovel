// ============================================
// AI Novel Platform - Shared TypeScript Types
// ============================================

// ---- 用户相关 ----
export interface User {
  id: string;
  username: string;
  email: string;
  role: 'reader' | 'admin';
  avatar_url?: string;
  created_at: number;
  updated_at: number;
}

export interface JWTPayload {
  sub: string;
  username: string;
  role: 'reader' | 'admin';
  exp: number;
  iat: number;
}

// ---- 投稿数据结构 ----
export interface SubmissionData {
  title: string;
  genre: string;
  language?: 'zh' | 'en';
  worldview: string;
  characters: CharacterBrief[];
  outline: string;
  core_conflict: string;
  tone: string;
  target_chapters?: number;
  additional_notes?: string;
}

export interface CharacterBrief {
  name: string;
  role: 'protagonist' | 'antagonist' | 'supporting';
  appearance: string;
  personality: string;
  motivation: string;
  backstory: string;
}

// ---- 书目 ----
export interface Book {
  id: string;
  title: string;
  genre: string;
  language: 'zh' | 'en';
  synopsis?: string;
  status: 'pending' | 'approved' | 'active' | 'completed' | 'paused';
  submitted_by: string;
  approved_by?: string;
  r2_core_prefix: string;
  current_chapter: number;
  total_words: number;
  submission_data: string;
  created_at: number;
  approved_at?: number;
  updated_at: number;
}

// ---- 章节 ----
export interface Chapter {
  id: string;
  book_id: string;
  chapter_number: number;
  title: string;
  r2_content_key: string;
  r2_summary_key?: string;
  r2_hooks_key?: string;
  r2_items_key?: string;
  r2_directions_key?: string;
  winning_direction_id?: string;
  status: 'generating' | 'published' | 'failed';
  word_count: number;
  created_at: number;
  published_at?: number;
}

// ---- 方向选项 ----
export interface Direction {
  id: string;
  chapter_id: string;
  book_id: string;
  direction_number: number;
  title: string;
  description: string;
  vote_count: number;
  status: 'voting' | 'won' | 'lost';
  created_at: number;
}

// ---- 投票 ----
export interface Vote {
  id: string;
  user_id: string;
  direction_id: string;
  chapter_id: string;
  book_id: string;
  created_at: number;
}

// ---- 角色申请 ----
export interface CharacterApplication {
  id: string;
  book_id: string;
  applicant_id: string;
  character_name: string;
  character_data: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string;
  review_note?: string;
  created_at: number;
  reviewed_at?: number;
}

export interface CharacterDetail {
  name: string;
  appearance: string;
  personality: string;
  backstory: string;
  motivation: string;
  abilities: string;
  relationship_to_existing?: string;
}

// ---- R2核心文件结构 ----
export interface WorldbuildingFile {
  geography: string;
  rules: string;
  factions: string;
  history: string;
  culture: string;
  magic_system?: string;
}

export interface PlotArchitectureFile {
  main_arc: string;
  sub_arcs: string[];
  conflict_layers: string;
  pacing_curve: string;
  climax_plan: string;
  resolution: string;
  current_progress: string;
}

export interface CharacterStateFile {
  characters: CharacterState[];
  relationship_map: string;
  arc_progress: Record<string, ArcProgress>;
}

export interface CharacterState {
  name: string;
  role: string;
  appearance: string;
  personality: string;
  current_status: string;
  location: string;
  goals: string[];
  inventory: string[];
  knowledge: string[];
  emotional_state: string;
  arc_stage: string;
}

export interface ArcProgress {
  character_name: string;
  stage: 'setup' | 'catalyst' | 'debate' | 'breakthrough' | 'new_plan' | 'progress' | 'crisis' | 'climax' | 'resolution';
  description: string;
  growth_percentage: number;
}

// ---- 章节辅助文件 ----
export interface HooksFile { active_hooks: Hook[]; resolved_hooks: Hook[]; }
export interface Hook {
  id: string;
  planted_in_chapter: number;
  description: string;
  expected_payoff?: string;
  resolved_in_chapter?: number;
  type: 'mystery' | 'foreshadowing' | 'cliffhanger' | 'promise' | 'subversion';
}
export interface ItemsFile { items: Item[]; }
export interface Item {
  name: string;
  description: string;
  type: 'weapon' | 'artifact' | 'clue' | 'tool' | 'currency' | 'other';
  current_holder: string;
  first_appeared_chapter: number;
  significance: string;
}
export interface DirectionsFile {
  chapter_number: number;
  directions: { number: number; title: string; description: string; }[];
}
export interface SummaryFile {
  chapter_number: number;
  title: string;
  summary: string;
  key_events: string[];
  character_changes: string[];
  items_introduced: string[];
  hooks_planted: string[];
}

// ---- API响应 ----
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ---- 环境变量 ----
export interface BaseEnv {
  DB: D1Database;
  KV: KVNamespace;
  R2_CORE: R2Bucket;
  R2_CHAPTERS: R2Bucket;
  JWT_SECRET: string;
}

export interface SubmissionEnv extends BaseEnv {
  AI: Ai;
  ORCHESTRATOR_QUEUE: Queue;
  AI_API_KEY: string;
  AI_BASE_URL: string;
  RESEND_API_KEY: string;
  ADMIN_EMAIL?: string;
}

export interface VotingEnv extends BaseEnv {
  VOTE_COUNTER: DurableObjectNamespace;
  CHAPTER_QUEUE: Queue;
  VOTE_THRESHOLD?: string;
}

export interface CharacterEnv extends BaseEnv {
  AI_API_KEY: string;
  AI_BASE_URL: string;
  RESEND_API_KEY: string;
  ADMIN_EMAIL?: string;
}

export interface ReadingEnv extends BaseEnv {}

export interface OrchestratorEnv extends BaseEnv {
  CHAPTER_QUEUE: Queue;
  AI_API_KEY: string;
  AI_MODEL: string;
  AI_BASE_URL: string;
  COVER_API_KEY?: string;
  COVER_BASE_URL?: string;
  COVER_MODEL?: string;
  COVER_SIZE?: string;
  COVER_WATERMARK?: string;
  COVER_RESPONSE_FORMAT?: 'url' | 'b64_json';
  VECTORIZE: VectorizeIndex;
  AI: Ai;
}

// ---- Durable Object: 投票计数器 ----
export interface VoteCounterState {
  chapter_id: string;
  book_id: string;
  direction_counts: Record<string, number>;
  total_votes: number;
  threshold: number;
  is_triggered: boolean;
}
