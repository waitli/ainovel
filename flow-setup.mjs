// 完整流程：注册 → 投稿 → 审批 → 自动章节生成 → 投票 → 下一章生成
import { ProxyAgent } from 'undici';
const agent = new ProxyAgent('http://172.20.224.1:8080');
const API = 'https://api.ainovel.waitli.top/api/v1';

const h = (token) => ({ 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) });
async function api(method, path, body, token) {
  const res = await fetch(`${API}${path}`, { method, headers: h(token), body: body ? JSON.stringify(body) : undefined, dispatcher: agent });
  const d = await res.json();
  if (!d.success) throw new Error(`${path}: ${d.error || d.message || JSON.stringify(d)}`);
  return d.data;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ---- 1. 注册用户 ----
console.log('=== 1. Register users ===');
const ts = Date.now();
const reader = await api('POST', '/auth/register', { username: `reader_${ts}`, email: `r${ts}@test.com`, password: 'test123456' });
console.log(`  Reader: ${reader.user.username} (${reader.user.id})`);
const admin = await api('POST', '/auth/register', { username: `admin_${ts}`, email: `a${ts}@test.com`, password: 'test123456' });
console.log(`  Admin:  ${admin.user.username} (${admin.user.id})`);

// 设为管理员 (需要通过 D1)
console.log('\n  ⚠ Set admin role in D1 manually:');
console.log(`  UPDATE users SET role='admin' WHERE id='${admin.user.id}';`);
process.exit(0);
