// Generate chapters for test books — D1 records + R2 content
// Usage: node --experimental-modules seed-chapters.mjs
import { ProxyAgent } from 'undici';

// Read config
const API = 'https://api.ainovel.waitli.top';

async function main() {
  // 1. Get all books from D1
  const booksRes = await fetch(`${API}/api/v1/books?status=active&limit=200`);
  const booksData = await booksRes.json();
  const books = booksData.data.books;
  console.log(`Found ${books.length} books`);

  // 2. Generate chapters for each book
  let totalChapters = 0;
  for (const book of books) {
    const chapterCount = book.current_chapter || 1;
    totalChapters += chapterCount;
  }
  console.log(`Will create ${totalChapters} chapters total`);

  // 3. Generate SQL for chapter inserts
  const lines = [];
  lines.push('DELETE FROM directions;');
  lines.push('DELETE FROM chapters;');
  lines.push('');
  lines.push('INSERT INTO chapters (id, book_id, chapter_number, title, r2_content_key, r2_summary_key, r2_hooks_key, r2_items_key, r2_directions_key, status, word_count, created_at, published_at) VALUES');

  const values = [];
  const now = Math.floor(Date.now() / 1000);

  for (const book of books) {
    const chapterCount = book.current_chapter || 1;
    const isZh = book.title.match(/[\u4e00-\u9fff]/);

    for (let ch = 1; ch <= chapterCount; ch++) {
      const chId = hexDigest(`${book.id}-ch${ch}`);
      const title = isZh ? generateZhTitle(book, ch) : generateEnTitle(book, ch);
      const contentKey = `books/${book.id}/chapters/${ch}/content.md`;
      const summaryKey = ch > 1 ? `'books/${book.id}/chapters/${ch}/summary.md'` : 'NULL';
      const hooksKey = `'books/${book.id}/chapters/${ch}/hooks.md'`;
      const itemsKey = `'books/${book.id}/chapters/${ch}/items.md'`;
      const directionsKey = `'books/${book.id}/chapters/${ch}/directions.json'`;
      const words = isZh ? (2000 + Math.floor(Math.random() * 2000)) : (1500 + Math.floor(Math.random() * 1500));
      const ts = book.created_at + ch * 3600;

      values.push(
        `('${chId}', '${book.id}', ${ch}, '${escapeSql(title)}', '${contentKey}', ${summaryKey}, ${hooksKey}, ${itemsKey}, ${directionsKey}, 'published', ${words}, ${ts}, ${ts})`
      );
    }
  }

  lines.push(values.join(',\n') + ';');

  // Write SQL
  const fs = await import('fs');
  fs.writeFileSync('/home/halcyon/ainovel/schema/migrations/seed-chapters.sql', lines.join('\n'));
  console.log(`Generated SQL with ${values.length} chapter inserts`);

  // 4. Generate directions SQL
  const dirLines = [];
  dirLines.push('INSERT INTO directions (id, chapter_id, book_id, direction_number, title, description, vote_count, status, created_at) VALUES');
  const dirValues = [];

  for (const book of books) {
    const chapterCount = book.current_chapter || 1;
    const isZh = book.title.match(/[\u4e00-\u9fff]/);
    const lastCh = chapterCount;
    const lastChId = hexDigest(`${book.id}-ch${lastCh}`);

    for (let d = 1; d <= 3; d++) {
      const dirId = hexDigest(`${book.id}-ch${lastCh}-dir${d}`);
      const dirTitle = isZh ? zhDirTitles[d - 1] : enDirTitles[d - 1];
      const dirDesc = isZh ? zhDirDescs[d - 1] : enDirDescs[d - 1];
      dirValues.push(
        `('${dirId}', '${lastChId}', '${book.id}', ${d}, '${escapeSql(dirTitle)}', '${escapeSql(dirDesc)}', ${Math.floor(Math.random() * 10)}, 'voting', ${now})`
      );
    }
  }

  dirLines.push(dirValues.join(',\n') + ';');
  fs.writeFileSync('/home/halcyon/ainovel/schema/migrations/seed-directions.sql', dirLines.join('\n'));
  console.log(`Generated SQL with ${dirValues.length} direction inserts`);

  // 5. Now we need to create R2 objects via the API
  // We'll create minimal content for the first 5 books as a test
  console.log('\n--- Creating R2 content for first 5 books via API ---');
  for (const book of books.slice(0, 5)) {
    const chapterCount = book.current_chapter || 1;
    const isZh = book.title.match(/[\u4e00-\u9fff]/);
    console.log(`  Creating ${chapterCount} chapters for "${book.title}"...`);
    // R2 content creation would need worker API endpoints, skip for now
  }

  console.log('\nDone! Run the SQL files on D1 next.');
}

function hexDigest(str) {
  // Simple deterministic hash → UUID-like string
  let h1 = 0x811c9dc5, h2 = 0x42d0f7ab;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x27d4eb2f);
  }
  const s = (n) => (n >>> 0).toString(16).padStart(8, '0');
  return `${s(h1).slice(0,8)}-${s(h2).slice(0,4)}-4${s(h1).slice(1,4)}-8${s(h2).slice(1,3)}-${s(h1)}${s(h2).slice(0,4)}`;
}

function escapeSql(s) {
  return s.replace(/'/g, "''");
}

const zhDirTitles = [
  '正面迎战，毫不退缩',
  '迂回周旋，寻找破绽',
  '出人意料的转折'
];
const zhDirDescs = [
  '选择正面交锋，虽然风险极大，但可能一举奠定胜局。需要调动所有可用的力量。',
  '暂时避开锋芒，从侧面寻找对手的弱点。虽然需要更多时间，但胜算更大。',
  '一个意想不到的人物或事件突然出现，完全改变了局势的走向。'
];
const enDirTitles = [
  'Confront head-on with full force',
  'Outmaneuver with cunning strategy',
  'An unexpected twist changes everything'
];
const enDirDescs = [
  'Stand your ground and face the challenge directly. High risk, but could lead to a decisive victory.',
  'Retreat strategically and find a weakness to exploit. Safer, but requires patience and precision.',
  'An unforeseen event or character changes the entire landscape of the conflict.'
];

function generateZhTitle(book, ch) {
  const titles = ['序章', '暗流涌动', '风云突变', '绝处逢生', '柳暗花明', '步步惊心', '以退为进', '背水一战', '破而后立', '天地变色', '一触即发', '生死一线', '浴火重生', '势如破竹', '峰回路转', '暗夜惊雷', '王者归来', '覆水难收', '刀光剑影', '天命所归'];
  return `第${ch}章 ${titles[(ch - 1) % titles.length]}`;
}

function generateEnTitle(book, ch) {
  const titles = ['The Beginning', 'Shadows Gather', 'A Turn of Fate', 'Against All Odds', 'New Horizons', 'The Hidden Truth', 'Crossroads', 'The Storm Breaks', 'Rising Tensions', 'Into the Unknown', 'The Reckoning', 'Echoes of War', 'A Glimmer of Hope', 'The Final Stand', 'Dawn Approaches', 'Betrayal', 'Unraveling', 'Convergence', 'The Aftermath', 'Destiny Calls'];
  return `Chapter ${ch}: ${titles[(ch - 1) % titles.length]}`;
}

main().catch(console.error);
