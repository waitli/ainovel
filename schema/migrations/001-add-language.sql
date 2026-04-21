-- Migration: Add language column to books table
-- Run with: wrangler d1 execute <DB_NAME> --remote --file=schema/migrations/001-add-language.sql

ALTER TABLE books ADD COLUMN language TEXT NOT NULL DEFAULT 'zh';
CREATE INDEX IF NOT EXISTS idx_books_language ON books(language, status);
