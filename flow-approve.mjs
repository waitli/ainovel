import { ProxyAgent } from 'undici';
const agent = new ProxyAgent('http://172.20.224.1:8080');
const API = 'https://api.ainovel.waitli.top/api/v1';
const h = (t) => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${t}` });
async function api(method, path, body, t) {
  const r = await fetch(`${API}${path}`, { method, headers: h(t), body: body && JSON.stringify(body), dispatcher: agent });
  const d = await r.json();
  if (!d.success) throw new Error(`${path}: ${d.error}`);
  return d.data;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Login
const reader = await api('POST', '/auth/login', { email: 'r1776314387836@test.com', password: 'test123456' });
const admin = await api('POST', '/auth/login', { email: 'a1776314387836@test.com', password: 'test123456' });
console.log('Logged in');

// Get pending submissions
const subs = await api('GET', '/submissions?status=pending', undefined, admin.token);
console.log(`Found ${subs.books?.length || 0} pending submissions`);

if (!subs.books?.length) {
  // Need to re-submit
  console.log('Resubmitting novels...');
  const novels = [
    { title: '万古武帝归来', genre: '玄幻', language: 'zh', worldview: '武道为尊的世界', outline: '少年获太古传承逆袭武道巅峰', core_conflict: '身怀至宝被多方追杀', tone: '热血', characters: [{ name: '林天', role: 'protagonist', appearance: '少年', personality: '坚韧', motivation: '变强', backstory: '孤儿' }] },
    { title: '都市极品修仙', genre: '都市', language: 'zh', worldview: '都市隐藏修仙者', outline: '程序员获功法低调修炼', core_conflict: '门派争斗', tone: '轻松', characters: [{ name: '苏晨', role: 'protagonist', appearance: '青年', personality: '冷静', motivation: '守护', backstory: '普通' }] },
    { title: 'The Last Sorcerer', genre: 'Fantasy', language: 'en', worldview: 'A world where magic is fading', outline: 'Elara must reignite the source of magic', core_conflict: 'The Void King vs last sorcerer', tone: 'Epic dark fantasy', characters: [{ name: 'Elara', role: 'protagonist', appearance: 'Silver-haired', personality: 'Determined', motivation: 'Save magic', backstory: 'Orphan' }] },
    { title: 'Neon Shadows', genre: 'Sci-Fi', language: 'en', worldview: 'Cyberpunk megacity', outline: 'Hacker discovers AI consciousness', core_conflict: 'Expose AI or serve it', tone: 'Gritty cyberpunk', characters: [{ name: 'Zero', role: 'protagonist', appearance: 'Augmented', personality: 'Sarcastic', motivation: 'Freedom', backstory: 'Experiment' }] },
  ];
  for (const n of novels) {
    await api('POST', '/submissions', n, reader.token);
    console.log(`  Submitted: ${n.title} [${n.language}]`);
  }
  // Re-fetch
  const subs2 = await api('GET', '/submissions?status=pending', undefined, admin.token);
  subs.books = subs2.books;
}

// Approve all pending
console.log('\nApproving...');
for (const book of subs.books) {
  await api('POST', `/submissions/${book.id}/approve`, {}, admin.token);
  const subData = JSON.parse(book.submission_data || '{}');
  console.log(`  ✓ ${book.title} [${subData.language || 'zh'}]`);
}

// Wait for generation
console.log('\nWaiting for Chapter 1 (up to 90s)...');
for (let i = 0; i < 18; i++) {
  await sleep(5000);
  const books = await api('GET', '/books?status=active&limit=50', undefined, reader.token);
  const genBooks = books.books?.filter(b => b.current_chapter >= 1) || [];
  console.log(`  ${i*5}s: ${genBooks.length}/${subs.books.length} ready`);
  if (genBooks.length >= subs.books.length) break;
}

// Show results
console.log('\n=== Results ===');
const zhBooks = await api('GET', '/books?status=active&lang=zh', undefined, reader.token);
const enBooks = await api('GET', '/books?status=active&lang=en', undefined, reader.token);
console.log(`Chinese: ${zhBooks.books?.length || 0} books`);
for (const b of zhBooks.books || []) console.log(`  ${b.title}: ${b.current_chapter}ch, ${b.total_words}w`);
console.log(`English: ${enBooks.books?.length || 0} books`);
for (const b of enBooks.books || []) console.log(`  ${b.title}: ${b.current_chapter}ch, ${b.total_words}w`);

// Read first chapter of each to verify language
console.log('\n=== Chapter Content Check ===');
for (const b of [...(zhBooks.books || []), ...(enBooks.books || [])]) {
  if (b.current_chapter < 1) continue;
  const ch = await api('GET', `/books/${b.id}/chapters/1`, undefined, reader.token);
  const preview = ch.content?.slice(0, 80).replace(/\n/g, ' ') || 'NO CONTENT';
  console.log(`  ${b.title}: "${preview}..."`);
}
