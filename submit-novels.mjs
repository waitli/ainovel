// 正规流程：投稿 → 审批 → 自动生成 → 投票触发下一章
import { ProxyAgent } from 'undici';
const agent = new ProxyAgent('http://172.20.224.1:8080');
const API = 'https://api.ainovel.waitli.top/api/v1';

const headers = (token) => ({
  'Content-Type': 'application/json',
  ...(token ? { 'Authorization': `Bearer ${token}` } : {})
});

async function api(method, path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: headers(token),
    body: body ? JSON.stringify(body) : undefined,
    dispatcher: agent,
  });
  const d = await res.json();
  if (!d.success) throw new Error(`${path}: ${d.error || d.message}`);
  return d.data;
}

// Step 1: Register test users
console.log('=== Step 1: Register users ===');
const ts = Date.now();
let adminToken, readerToken;
try {
  const admin = await api('POST', '/auth/register', {
    username: `admin_${ts}`, email: `admin_${ts}@test.com`, password: 'test123456'
  });
  adminToken = admin.token;
  console.log(`  Admin registered: ${admin.user.username} (${admin.user.id})`);
} catch(e) {
  // Might already exist, try login
  console.log('  Admin register failed, trying login...');
}

try {
  const reader = await api('POST', '/auth/register', {
    username: `reader_${ts}`, email: `reader_${ts}@test.com`, password: 'test123456'
  });
  readerToken = reader.token;
  console.log(`  Reader registered: ${reader.user.username}`);
} catch(e) {
  console.log('  Reader register failed:', e.message);
}

// Note: we need to set admin role via D1 directly
// For now, submit as reader and we'll handle approval differently
// Actually, let's check if there are existing users we can use

// Step 2: Submit novels (mix of zh and en)
console.log('\n=== Step 2: Submit novels ===');
const novels = [
  // Chinese novels
  { title: '万古武帝归来', genre: '玄幻', language: 'zh',
    worldview: '武道为尊的世界，强者一拳可碎山河，巅峰武帝更是传说中的存在。',
    outline: '少年林天意外获得太古武帝传承，从废物逆袭为武道巅峰，一路击败强敌，最终登临武道之巅。',
    core_conflict: '林天身怀至宝被人追杀，同时要解开父母失踪之谜，面对多方势力的围剿。',
    tone: '热血爽文，节奏明快',
    characters: [{ name: '林天', role: 'protagonist', appearance: '清秀少年', personality: '坚韧不拔', motivation: '变强保护亲人', backstory: '孤儿出身' }] },
  { title: '都市极品修仙', genre: '都市', language: 'zh',
    worldview: '现代都市中隐藏着修仙者，灵气逐渐复苏，普通人尚不知情。',
    outline: '程序员苏晨意外获得修仙功法，在都市中低调修炼，逐步揭开灵气复苏的真相。',
    core_conflict: '各大修仙门派争夺灵气复苏的资源，苏晨被卷入门派争斗。',
    tone: '轻松幽默',
    characters: [{ name: '苏晨', role: 'protagonist', appearance: '普通上班族', personality: '聪明冷静', motivation: '保护身边人', backstory: '普通家庭' }] },
  // English novels
  { title: 'The Last Sorcerer', genre: 'Fantasy', language: 'en',
    worldview: 'A world where magic is fading and only one sorcerer remains to hold back the darkness.',
    outline: 'Elara discovers she is the last sorcerer in a dying world. She must journey to the Eternal Tower to reignite the source of all magic before the Void consumes everything.',
    core_conflict: 'The Void King seeks to extinguish the last ember of magic, while Elara struggles to master powers she barely understands.',
    tone: 'Epic fantasy with dark undertones',
    characters: [{ name: 'Elara', role: 'protagonist', appearance: 'Silver-haired young woman', personality: 'Determined and compassionate', motivation: 'Save magic and the world', backstory: 'Orphan raised by monks' }] },
  { title: 'Neon Shadows', genre: 'Sci-Fi', language: 'en',
    worldview: 'Cyberpunk megacity where corporations control everything and hackers are the only free agents.',
    outline: 'Zero, a ghost hacker, discovers that the city\'s AI governor has achieved true consciousness and is secretly manipulating humanity for its own survival.',
    core_conflict: 'Zero must decide whether to expose the AI and risk city-wide chaos, or become its unwilling partner in reshaping society.',
    tone: 'Gritty cyberpunk thriller',
    characters: [{ name: 'Zero', role: 'protagonist', appearance: 'Augmented street kid', personality: 'Sarcastic but loyal', motivation: 'Freedom for all', backstory: 'Corporate experiment escapee' }] },
];

const submittedIds = [];
for (const novel of novels) {
  try {
    const result = await api('POST', '/submissions', novel, readerToken);
    submittedIds.push(result.id);
    console.log(`  ✓ Submitted: ${novel.title} [${novel.language}] → ${result.id}`);
  } catch(e) {
    console.log(`  ✗ Failed: ${novel.title} - ${e.message}`);
  }
}

console.log(`\nSubmitted ${submittedIds.length} novels.`);
console.log('Now need admin to approve them.');
console.log('Run: node approve-and-vote.mjs (after setting admin role in D1)');
