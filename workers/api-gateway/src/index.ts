// ============================================
// API 网关 — 统一入口，路由到各个子 Worker
// ============================================

interface Env {
  AUTH_SERVICE: Fetcher;
  SUBMISSION_SERVICE: Fetcher;
  VOTING_SERVICE: Fetcher;
  CHARACTER_SERVICE: Fetcher;
  READING_SERVICE: Fetcher;
  ORCHESTRATOR_SERVICE: Fetcher;
}

// CORS 头
const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

// 路由表 (更具体的在前)
const ROUTES: [RegExp, keyof Env][] = [
  [/^\/api\/v1\/auth/, 'AUTH_SERVICE'],
  [/^\/api\/v1\/admin\/users/, 'AUTH_SERVICE'],
  [/^\/api\/v1\/admin\/(approve|reject)-book/, 'SUBMISSION_SERVICE'],
  [/^\/api\/v1\/admin\/(approve|reject)-character/, 'CHARACTER_SERVICE'],
  [/^\/api\/v1\/admin\/books/, 'READING_SERVICE'],
  [/^\/api\/v1\/submissions/, 'SUBMISSION_SERVICE'],
  [/^\/api\/v1\/books\/[^/]+\/characters/, 'CHARACTER_SERVICE'],
  [/^\/api\/v1\/characters/, 'CHARACTER_SERVICE'],
  [/^\/api\/v1\/votes/, 'VOTING_SERVICE'],
  [/^\/api\/v1\/books/, 'READING_SERVICE'],
  [/^\/api\/v1\/chapters/, 'READING_SERVICE'],
];

const DEFAULT_SERVICE: keyof Env = 'READING_SERVICE';

function corsHeaders(response: Response): Response {
  const r = new Response(response.body, response);
  for (const [k, v] of Object.entries(CORS)) r.headers.set(k, v);
  return r;
}

function jsonWithCors(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    const { pathname } = url;

    // 健康检查
    if (pathname === '/api/health') {
      return jsonWithCors({ status: 'ok', timestamp: Date.now() });
    }

    // 匹配路由
    let targetService: Fetcher = env[DEFAULT_SERVICE];
    for (const [pattern, serviceName] of ROUTES) {
      if (pattern.test(pathname)) { targetService = env[serviceName]; break; }
    }

    // 转发
    try {
      const response = await targetService.fetch(request);
      return corsHeaders(response);
    } catch (err: any) {
      return jsonWithCors({ error: `Service error: ${err.message}` }, 502);
    }
  },
};
