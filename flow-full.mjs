// 完整流程：登录 → 投稿(中/英) → 审批 → 等待生成 → 投票 → 继续生成
import { ProxyAgent } from 'undici';
const agent = new ProxyAgent('http://172.20.224.1:8080');
const API = 'https://api.ainovel.waitli.top/api/v1';

const h = (token) => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` });
async function api(method, path, body, token) {
  const res = await fetch(`${API}${path}`, { method, headers: h(token), body: body ? JSON.stringify(body) : undefined, dispatcher: agent });
  const d = await res.json();
  if (!d.success) throw new Error(`${path}: ${d.error || d.message}`);
  return d.data;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ---- 登录 ----
const reader = await api('POST', '/auth/login', { email: 'r1776314387836@test.com', password: 'test123456' });
const admin = await api('POST', '/auth/login', { email: 'a1776314387836@test.com', password: 'test123456' });
console.log(`Reader: ${reader.user.username} | Admin: ${admin.user.username}`);

// ---- 投稿 ----
const novels = [
  { title: '万古武帝归来', genre: '玄幻', language: 'zh',
    worldview: '武道为尊的世界，强者一拳碎山河，巅峰武帝更是传说。',
    outline: '少年林天获太古传承，从废物逆袭武道巅峰，揭开父母失踪真相。',
    core_conflict: '身怀至宝被多方势力追杀，同时要解开身世之谜。',
    tone: '热血爽文', characters: [{ name: '林天', role: 'protagonist', appearance: '清秀少年', personality: '坚韧不拔', motivation: '变强护亲', backstory: '孤儿' }] },
  { title: '都市极品修仙', genre: '都市', language: 'zh',
    worldview: '现代都市隐藏修仙者，灵气悄然复苏。',
    outline: '程序员获修仙功法，低调修炼，揭开灵气复苏真相。',
    core_conflict: '各门派争夺灵气资源，被卷入纷争。',
    tone: '轻松幽默', characters: [{ name: '苏晨', role: 'protagonist', appearance: '普通青年', personality: '冷静聪明', motivation: '守护身边人', backstory: '普通家庭' }] },
  { title: 'The Last Sorcerer', genre: 'Fantasy', language: 'en',
    worldview: 'A world where magic is fading. Only one sorcerer remains to hold back the darkness.',
    outline: 'Elara discovers she is the last sorcerer. She must reignite the source of magic before the Void consumes everything.',
    core_conflict: 'The Void King seeks to extinguish magic, while Elara struggles to master powers she barely understands.',
    tone: 'Epic dark fantasy', characters: [{ name: 'Elara', role: 'protagonist', appearance: 'Silver-haired woman', personality: 'Determined', motivation: 'Save magic', backstory: 'Orphan' }] },
  { title: 'Neon Shadows', genre: 'Sci-Fi', language: 'en',
    worldview: 'Cyberpunk megacity where corporations control everything.',
    outline: 'Ghost hacker Zero discovers the city AI has achieved consciousness and is secretly manipulating humanity.',
    core_conflict: 'Expose the AI and risk chaos, or become its unwilling partner.',
    tone: 'Gritty cyberpunk', characters: [{ name: 'Zero', role: 'protagonist', appearance: 'Augmented kid', personality: 'Sarcastic loyal', motivation: 'Freedom', backstory: 'Escaped experiment' }] },
];

console.log('\n=== Submitting novels ===');
const submitted = [];
for (const n of novels) {
  const r = await api('POST', '/submissions', n, reader.token);
  submitted.push({ ...n, id: r.id });
  console.log(`  ✓ ${n.title} [${n.language}] → ${r.id}`);
}

// ---- 审批 ----
console.log('\n=== Approving novels ===');
for (const n of submitted) {
  await api('POST', `/submissions/${n.id}/approve`, {}, admin.token);
  console.log(`  ✓ Approved: ${n.title}`);
}

// ---- 等待第一章生成 ----
console.log('\n=== Waiting for Chapter 1 generation (up to 60s) ===');
for (let attempt = 0; attempt < 12; attempt++) {
  await sleep(5000);
  let allReady = true;
  for (const n of submitted) {
    try {
      const book = await api('GET', `/books/${n.id}`, undefined, reader.token);
      if (book.current_chapter >= 1) {
        if (attempt === 0 || attempt === 5) console.log(`  ✓ ${n.title}: ${book.current_chapter} chapters`);
      } else {
        allReady = false;
      }
    } catch(e) {
      allReady = false;
    }
  }
  if (allReady) { console.log('  All books have Chapter 1!'); break; }
  if (attempt === 11) console.log('  Timeout - some books may still be generating');
}

// ---- 投票触发下一章 ----
console.log('\n=== Voting to trigger Chapter 2 ===');
for (const n of submitted) {
  try {
    // Get chapter 1 directions
    const book = await api('GET', `/books/${n.id}`, undefined, reader.token);
    if (book.current_chapter < 1) continue;
    
    const dirs = await api('GET', `/books/${n.id}/chapters/1/directions`, undefined, reader.token);
    if (!dirs.directions || dirs.directions.length === 0) {
      console.log(`  ⚠ ${n.title}: no directions yet`);
      continue;
    }
    
    // Vote for direction 1 (3 votes to trigger, but we only have 1 user)
    // We'll need multiple users or admin can force-trigger
    const result = await api('POST', '/votes', { direction_id: dirs.directions[0].id }, reader.token);
    console.log(`  Voted on ${n.title}: triggered=${result.triggered}`);
    
    if (!result.triggered) {
      // Need more votes - register extra users
      console.log(`    Need ${3 - (result.current_votes || 0)} more votes`);
    }
  } catch(e) {
    console.log(`  ✗ ${n.title}: ${e.message}`);
  }
}

// ---- 注册额外用户补票 ----
console.log('\n=== Extra voters ===');
for (const n of submitted) {
  try {
    const book = await api('GET', `/books/${n.id}`, undefined, reader.token);
    if (book.current_chapter >= 2) continue;
    
    const dirs = await api('GET', `/books/${n.id}/chapters/1/directions`, undefined, reader.token);
    if (!dirs.directions?.length) continue;
    
    // Register 2 more users and vote
    for (let v = 0; v < 2; v++) {
      const voter = await api('POST', '/auth/register', {
        username: `voter_${Date.now()}_${v}`, email: `v${Date.now()}${v}@test.com`, password: 'test123456'
      });
      const voteResult = await api('POST', '/votes', { direction_id: dirs.directions[0].id }, voter.token);
      console.log(`  Voter ${v+1} voted on ${n.title}: triggered=${voteResult.triggered}`);
      if (voteResult.triggered) break;
    }
  } catch(e) {
    console.log(`  ✗ ${n.title}: ${e.message}`);
  }
}

// ---- 最终状态 ----
console.log('\n=== Final Status ===');
await sleep(10000); // Wait for generation
for (const n of submitted) {
  try {
    const book = await api('GET', `/books/${n.id}`, undefined, reader.token);
    console.log(`  ${n.title} [${n.language}]: ${book.current_chapter} chapters, ${book.total_words} words`);
  } catch(e) {
    console.log(`  ${n.title}: error`);
  }
}

// Verify language filtering
console.log('\n=== Language Filter Test ===');
const zhBooks = await api('GET', '/books?status=active&lang=zh&limit=50', undefined, reader.token);
const enBooks = await api('GET', '/books?status=active&lang=en&limit=50', undefined, reader.token);
console.log(`  zh filter: ${zhBooks.books.length} books (should be ${novels.filter(n=>n.language==='zh').length})`);
console.log(`  en filter: ${enBooks.books.length} books (should be ${novels.filter(n=>n.language==='en').length})`);
for (const b of zhBooks.books) console.log(`    [zh] ${b.title}`);
for (const b of enBooks.books) console.log(`    [en] ${b.title}`);
