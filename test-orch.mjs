// 最小化测试 orchestrator
const ORCH = 'https://ainovel-orchestrator.waitli.workers.dev';
const PROXY = 'http://172.20.224.1:8080';
const { ProxyAgent } = await import('undici');
const d = new ProxyAgent({ uri: PROXY });

// 1. Health check
console.log('1. Health...');
const r1 = await fetch(`${ORCH}/health`, { dispatcher: d });
console.log(`   ${r1.status} ${await r1.text()}\n`);

// 2. 直接调用 init-book (会失败但看错误信息)
console.log('2. init-book (expect error, checking message)...');
const r2 = await fetch(`${ORCH}/init-book`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'INIT_BOOK',
    book_id: 'test-123',
    submission: {
      title: '测试', genre: '玄幻',
      worldview: '测试世界观',
      outline: '测试大纲',
      core_conflict: '测试冲突',
      characters: [{ name: '主角', role: 'protagonist', appearance: '少年', personality: '坚毅', motivation: '变强', backstory: '废物' }],
    }
  }),
  dispatcher: d,
});
console.log(`   ${r2.status} ${await r2.text()}\n`);

console.log('Done');
