// 通过 Cloudflare API 创建 AI Gateway
const PROXY = 'http://172.20.224.1:8080';
const { ProxyAgent } = await import('undici');
const d = new ProxyAgent({ uri: PROXY });

const ACCOUNT_ID = '9a89dfd8acd8946a17ab969d59bef574';

// 需要 API Token，用 wrangler 的 OAuth token 不够
// 先尝试用 Dashboard URL 让用户手动创建
console.log('AI Gateway 需要通过 Dashboard 创建:');
console.log(`https://dash.cloudflare.com/${ACCOUNT_ID}/ai/ai-gateway`);
console.log('');
console.log('步骤:');
console.log('1. 打开上面的链接');
console.log('2. 点击 "Create Gateway"');
console.log('3. 名称: ainovel-gateway');
console.log('4. 创建后，把 Gateway URL 发给我');
console.log('');
console.log('或者提供你的 Cloudflare API Token，我可以通过 API 创建');
