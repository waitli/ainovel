import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const PUBLIC_DIR = join(PROJECT_ROOT, 'public');
const OUTPUT_PATH = join(PUBLIC_DIR, 'sitemap.xml');

const SITE_URL = (process.env.SITE_URL || 'https://ainovel.waitli.top').replace(/\/+$/, '');
const API_BASE = (process.env.SITEMAP_API_BASE || 'https://api.ainovel.waitli.top/api/v1').replace(/\/+$/, '');
const PAGE_LIMIT = 50;
const MAX_PAGES = 20;

function xmlEscape(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function toIso(value) {
  if (value === null || value === undefined || value === '') return null;
  let normalized = value;

  if (typeof normalized === 'string' && /^\d+(\.\d+)?$/.test(normalized)) {
    normalized = Number(normalized);
  }

  if (typeof normalized === 'number' && Number.isFinite(normalized)) {
    // D1 often stores Unix seconds; Date expects milliseconds.
    normalized = normalized < 1e12 ? normalized * 1000 : normalized;
  }

  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

async function fetchJson(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${path}`);
  }
  const payload = await res.json();
  if (!payload?.success) {
    throw new Error(`API failed for ${path}: ${payload?.error || 'unknown error'}`);
  }
  return payload.data;
}

async function loadBooks() {
  const books = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const data = await fetchJson(`/books?status=active&sort=updated_at&page=${page}&limit=${PAGE_LIMIT}`);
    const chunk = Array.isArray(data?.books) ? data.books : [];
    if (!chunk.length) break;
    books.push(...chunk);
    if (chunk.length < PAGE_LIMIT) break;
  }
  return books;
}

async function loadChapters(bookId) {
  const data = await fetchJson(`/books/${encodeURIComponent(bookId)}/chapters`);
  return Array.isArray(data?.chapters) ? data.chapters : [];
}

function buildXml(urls) {
  const body = urls
    .map((entry) => {
      const locUrl = new URL(entry.path, SITE_URL);
      locUrl.searchParams.set('lang', 'en');
      const loc = locUrl.toString();
      const lastmod = entry.lastmod ? `\n    <lastmod>${xmlEscape(entry.lastmod)}</lastmod>` : '';
      const priority = entry.priority ? `\n    <priority>${entry.priority}</priority>` : '';
      const changefreq = entry.changefreq ? `\n    <changefreq>${entry.changefreq}</changefreq>` : '';
      return `  <url>\n    <loc>${xmlEscape(loc)}</loc>${lastmod}${changefreq}${priority}\n  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${body}\n` +
    `</urlset>\n`;
}

async function main() {
  const urls = [
    {
      path: '/',
      lastmod: new Date().toISOString(),
      changefreq: 'hourly',
      priority: '1.0',
    },
  ];

  try {
    const books = await loadBooks();
    const dedupBookIds = new Set();

    for (const book of books) {
      if (!book?.id || dedupBookIds.has(book.id)) continue;
      dedupBookIds.add(book.id);

      urls.push({
        path: `/books/${book.id}`,
        lastmod: toIso(book.updated_at || book.created_at),
        changefreq: 'daily',
        priority: '0.9',
      });

      try {
        const chapters = await loadChapters(book.id);
        for (const chapter of chapters) {
          const chapterNumber = chapter?.chapter_number;
          if (!Number.isInteger(chapterNumber) || chapterNumber < 1) continue;
          urls.push({
            path: `/books/${book.id}/chapters/${chapterNumber}`,
            lastmod: toIso(chapter?.published_at || book.updated_at || book.created_at),
            changefreq: 'weekly',
            priority: '0.8',
          });
        }
      } catch (chapterErr) {
        console.warn(`[sitemap] skip chapters for ${book.id}: ${chapterErr.message}`);
      }
    }
  } catch (err) {
    console.warn(`[sitemap] fallback to homepage-only sitemap: ${err.message}`);
  }

  const xml = buildXml(urls);
  await mkdir(PUBLIC_DIR, { recursive: true });
  await writeFile(OUTPUT_PATH, xml, 'utf8');
  console.log(`[sitemap] wrote ${urls.length} urls -> ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error('[sitemap] generation failed:', err);
  process.exit(1);
});
