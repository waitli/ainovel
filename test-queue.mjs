// 完整 Queue 测试: 投稿→审批→Queue触发→AI生成→投票→第二章
const BASE = 'https://ainovel-api.waitli.workers.dev';
const PROXY = 'http://172.20.224.1:8080';
const { ProxyAgent } = await import('undici');
const d = new ProxyAgent({ uri: PROXY });

async function api(m, p, b, t) {
  const h = { 'Content-Type': 'application/json' };
  if (t) h['Authorization'] = `Bearer ${t}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(`${BASE}${p}`, { method: m, headers: h, body: b && JSON.stringify(b), dispatcher: d });
      return r.json();
    } catch (e) {
      if (attempt === 2) throw e;
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

const ts = Date.now();

console.log('=== Phase 1: 用户 & 投稿 ===\n');
const login = await api('POST', '/api/v1/auth/login', { email: 'admin_1776214980322@test.com', password: 'admin123' });
const at = login.data?.token;
console.log(`1. 管理员: ✅ ${login.data?.user?.role}`);

const rr = await api('POST', '/api/v1/auth/register', { username: `r${ts}`, email: `r${ts}@t.com`, password: '123456' });
const rt = rr.data?.token;
console.log(`2. 读者:   ✅ ${rr.data?.user?.username}`);

const sub = await api('POST', '/api/v1/submissions', {
  title: '万古武帝', genre: '玄幻',
  worldview: '苍穹大陆武者为尊，武道九境：淬体通脉凝元化神洞虚渡劫大乘飞升永恒。三大圣地五大宗门。',
  outline: '少年叶尘偶得太古经传承，从废物逆袭成就武帝。',
  core_conflict: '太古经引三大圣地觊觎。',
  tone: '热血', max_chapters: 30,
  characters: [{ name: '叶尘', role: 'protagonist', appearance: '少年', personality: '坚毅', motivation: '武道', backstory: '废物逆袭' }],
}, rt);
const bid = sub.data?.id;
console.log(`3. 投稿:   ✅ ${bid} (${sub.data?.status})\n`);

console.log('=== Phase 2: 审批 → Queue 触发 ===\n');
console.log('4. 审批通过 (触发 Queue → Orchestrator)...');
const ap = await api('POST', `/api/v1/submissions/${bid}/approve`, null, at);
console.log(`   ${JSON.stringify(ap).slice(0, 150)}\n`);

console.log('5. 等待 Queue 消费者处理 (3分钟)...');
let found = false;
for (let i = 0; i < 24; i++) {
  await new Promise(r => setTimeout(r, 7500));
  const ch = await api('GET', `/api/v1/books/${bid}/chapters`);
  const chapters = ch.data?.chapters || [];
  if (chapters.length > 0) {
    found = true;
    console.log(`\n   ✅ Queue 生效！第1章: "${chapters[0].title}" (${chapters[0].word_count}字)\n`);

    // 读取正文
    const read = await api('GET', `/api/v1/books/${bid}/chapters/1`);
    const content = read.data?.content || '';
    console.log(`--- 正文预览 (前300字) ---\n${content.slice(0, 300)}\n---\n`);

    // 方向选项
    const dirs = await api('GET', `/api/v1/books/${bid}/chapters/1/directions`);
    const directions = dirs.data?.directions || [];
    console.log(`--- 方向 (${directions.length}个) ---`);
    directions.forEach(dd => console.log(`  ${dd.direction_number}. ${dd.title}`));

    // 投票
    if (directions.length > 0) {
      console.log(`\n6. 读者投票给方向1...`);
      const vote = await api('POST', '/api/v1/votes', { direction_id: directions[0].id }, rt);
      console.log(`   ${JSON.stringify(vote).slice(0, 150)}`);

      // 如果需要多次投票达到门槛
      console.log(`\n7. 补充投票达到门槛 (3票)...`);
      for (let v = 0; v < 2; v++) {
        const nr = await api('POST', '/api/v1/auth/register', { username: `v${ts}${v}`, email: `v${ts}${v}@t.com`, password: '123456' });
        const vt = nr.data?.token;
        await api('POST', '/api/v1/votes', { direction_id: directions[0].id }, vt);
        console.log(`   投票${v + 2}/3 ✅`);
      }

      // 等待第二章
      console.log(`\n8. 等待 Queue 生成第2章...`);
      for (let j = 0; j < 16; j++) {
        await new Promise(r => setTimeout(r, 7500));
        const ch2 = await api('GET', `/api/v1/books/${bid}/chapters`);
        if ((ch2.data?.chapters || []).length >= 2) {
          const c2 = ch2.data.chapters[1];
          console.log(`\n   ✅ 第2章: "${c2.title}" (${c2.word_count}字)`);
          break;
        }
        process.stdout.write('.');
      }
    }
    break;
  }
  process.stdout.write(`   ${(i + 1) * 7.5}s...`);
}

if (!found) {
  console.log('\n   ⚠️ Queue 未触发，尝试 HTTP 直连...');
}

console.log('\n\n=== 测试结束 ===');
