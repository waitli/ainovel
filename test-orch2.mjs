// 测试 orchestrator (长超时)
const ORCH = 'https://ainovel-orchestrator.waitli.workers.dev';
const PROXY = 'http://172.20.224.1:8080';
const { ProxyAgent } = await import('undici');
const d = new ProxyAgent({ uri: PROXY });

console.log('调用 orchestrator init-book...');
console.log('等待 AI 生成 (最多5分钟)...\n');

const controller = new AbortController();
setTimeout(() => controller.abort(), 300000); // 5 min

try {
  const r = await fetch(`${ORCH}/init-book`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'INIT_BOOK',
      book_id: `test-${Date.now()}`,
      submission: {
        title: '测试小说', genre: '玄幻',
        worldview: '测试世界观：一个武者为尊的世界',
        outline: '少年逆袭成为最强者',
        core_conflict: '正邪对抗',
        tone: '热血',
        characters: [{ name: '主角', role: 'protagonist', appearance: '少年', personality: '坚毅', motivation: '变强', backstory: '废物逆袭' }],
      }
    }),
    dispatcher: d,
    signal: controller.signal,
  });
  const text = await r.text();
  console.log(`状态: ${r.status}`);
  console.log(`响应: ${text.slice(0, 500)}`);
} catch (e) {
  console.log(`错误: ${e.message}`);
}
