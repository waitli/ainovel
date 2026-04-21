-- ============================================
-- AI Novel Platform - D1 Database Schema
-- ============================================
-- 6张表：用户、书目、章节元数据、方向选项、投票记录、角色申请

-- 用户表 (读者 + 管理员)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'reader' CHECK (role IN ('reader', 'admin')),
    avatar_url TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- 书目表
CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    genre TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'zh' CHECK (language IN ('zh', 'en')),
    synopsis TEXT,                    -- 简介(审批通过后由AI生成)
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'active', 'completed', 'paused')),
    submitted_by TEXT NOT NULL,       -- 投稿人 user_id
    approved_by TEXT,                 -- 审批管理员 user_id
    r2_core_prefix TEXT NOT NULL,     -- R2桶A路径: books/{book_id}/
    current_chapter INTEGER NOT NULL DEFAULT 0,
    total_words INTEGER NOT NULL DEFAULT 0,
    -- 投稿原始数据(JSON)
    submission_data TEXT NOT NULL,    -- JSON: {worldview, outline, characters, conflict, ...}
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    approved_at INTEGER,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (submitted_by) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id)
);

CREATE INDEX idx_books_status ON books(status);
CREATE INDEX idx_books_submitted_by ON books(submitted_by);
CREATE INDEX idx_books_genre ON books(genre);
CREATE INDEX idx_books_language ON books(language, status);

-- 章节元数据表
CREATE TABLE IF NOT EXISTS chapters (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    chapter_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    -- R2桶B中的文件key
    r2_content_key TEXT NOT NULL,     -- books/{book_id}/chapters/{num}/content.md
    r2_summary_key TEXT,              -- books/{book_id}/chapters/{num}/summary.md
    r2_hooks_key TEXT,                -- books/{book_id}/chapters/{num}/hooks.md
    r2_items_key TEXT,                -- books/{book_id}/chapters/{num}/items.md
    r2_directions_key TEXT,           -- books/{book_id}/chapters/{num}/directions.json
    winning_direction_id TEXT,        -- 胜出的方向ID
    status TEXT NOT NULL DEFAULT 'generating'
        CHECK (status IN ('generating', 'published', 'failed')),
    word_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    published_at INTEGER,
    FOREIGN KEY (book_id) REFERENCES books(id),
    UNIQUE(book_id, chapter_number)
);

CREATE INDEX idx_chapters_book_id ON chapters(book_id);
CREATE INDEX idx_chapters_status ON chapters(status);

-- 方向选项表 (每章2-4个方向供投票)
CREATE TABLE IF NOT EXISTS directions (
    id TEXT PRIMARY KEY,
    chapter_id TEXT NOT NULL,
    book_id TEXT NOT NULL,
    direction_number INTEGER NOT NULL, -- 1, 2, 3, 4
    title TEXT NOT NULL,               -- 方向简述
    description TEXT NOT NULL,         -- 方向详细描述
    vote_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'voting'
        CHECK (status IN ('voting', 'won', 'lost')),
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (chapter_id) REFERENCES chapters(id),
    FOREIGN KEY (book_id) REFERENCES books(id),
    UNIQUE(chapter_id, direction_number)
);

CREATE INDEX idx_directions_chapter ON directions(chapter_id);
CREATE INDEX idx_directions_book ON directions(book_id);

-- 投票记录表
CREATE TABLE IF NOT EXISTS votes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    direction_id TEXT NOT NULL,
    chapter_id TEXT NOT NULL,
    book_id TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (direction_id) REFERENCES directions(id),
    FOREIGN KEY (chapter_id) REFERENCES chapters(id),
    FOREIGN KEY (book_id) REFERENCES books(id),
    -- 每个用户每章只能投一票
    UNIQUE(user_id, chapter_id)
);

CREATE INDEX idx_votes_user ON votes(user_id);
CREATE INDEX idx_votes_direction ON votes(direction_id);
CREATE INDEX idx_votes_chapter ON votes(chapter_id);

-- 角色申请表 (读者申请将自己的角色写入书中)
CREATE TABLE IF NOT EXISTS character_applications (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    applicant_id TEXT NOT NULL,       -- 申请读者 user_id
    character_name TEXT NOT NULL,
    character_data TEXT NOT NULL,     -- JSON: {name, appearance, personality, backstory, motivation, abilities}
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by TEXT,                 -- 审批管理员
    review_note TEXT,                 -- 审批备注
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    reviewed_at INTEGER,
    FOREIGN KEY (book_id) REFERENCES books(id),
    FOREIGN KEY (applicant_id) REFERENCES users(id),
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
);

CREATE INDEX idx_char_app_book ON character_applications(book_id);
CREATE INDEX idx_char_app_applicant ON character_applications(applicant_id);
CREATE INDEX idx_char_app_status ON character_applications(status);
