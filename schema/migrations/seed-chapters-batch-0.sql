DELETE FROM directions;
DELETE FROM chapters;

INSERT INTO chapters (id, book_id, chapter_number, title, r2_content_key, r2_summary_key, r2_hooks_key, r2_items_key, r2_directions_key, status, word_count, created_at, published_at) VALUES
('11ff989e-989e-4944-f259-b7d1c88a2d81', '46e1aa83aa7ed0317612461c92da1ba3', 8, 'Chapter 8: The Storm Breaks', 'books/46e1aa83aa7ed0317612461c92da1ba3/chapters/8/content.md', 'books/46e1aa83aa7ed0317612461c92da1ba3/chapters/8/summary.md', 'books/46e1aa83aa7ed0317612461c92da1ba3/chapters/8/hooks.md', 'books/46e1aa83aa7ed0317612461c92da1ba3/chapters/8/items.md', 'books/46e1aa83aa7ed0317612461c92da1ba3/chapters/8/directions.json', 'published', 2140, 1777128800, 1777128800);
