// ============================================
// 共享工具函数
// ============================================

import type { ApiResponse } from './types';
import { BOOKS_CACHE_VERSION_KEY } from './constants';

// ---- JWT 工具 ----

function base64UrlEncode(data: Uint8Array): string {
  let str = btoa(String.fromCharCode(...data));
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  return new Uint8Array([...bin].map(c => c.charCodeAt(0)));
}

async function getSigningKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function createJWT(
  payload: Record<string, any>,
  secret: string
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const enc = new TextEncoder();

  const headerB64 = base64UrlEncode(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(payload)));
  const data = `${headerB64}.${payloadB64}`;

  const key = await getSigningKey(secret);
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    enc.encode(data)
  );

  const sigB64 = base64UrlEncode(new Uint8Array(signature));
  return `${data}.${sigB64}`;
}

export async function verifyJWT(
  token: string,
  secret: string
): Promise<Record<string, any> | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, sigB64] = parts;
    const data = `${headerB64}.${payloadB64}`;

    const key = await getSigningKey(secret);
    const signature = base64UrlDecode(sigB64);

    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      new TextEncoder().encode(data)
    );

    if (!valid) return null;

    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(payloadB64))
    );

    // 检查过期
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// ---- UUID 生成 ----

export function generateId(): string {
  return crypto.randomUUID();
}

// ---- API响应工具 ----

export function jsonResponse<T>(
  data: T,
  status: number = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export function successResponse<T>(data: T, message?: string): Response {
  return jsonResponse<ApiResponse<T>>({ success: true, data, message });
}

export function errorResponse(error: string, status: number = 400): Response {
  return jsonResponse<ApiResponse>({ success: false, error }, status);
}

export function notFoundError(resource: string): Response {
  return errorResponse(`${resource} not found`, 404);
}

export function unauthorizedError(): Response {
  return errorResponse('Unauthorized', 401);
}

export function forbiddenError(): Response {
  return errorResponse('Forbidden', 403);
}

// ---- CORS预检 ----

export function corsResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

// ---- 路由匹配 ----

interface RouteMatch {
  pattern: URLPattern;
  params: Record<string, string>;
}

export function matchRoute(
  method: string,
  pathname: string,
  requestMethod: string,
  routes: { method: string; path: string; handler: Function }[]
): { handler: Function; params: Record<string, string> } | null {
  for (const route of routes) {
    if (route.method !== requestMethod && route.method !== 'ALL') continue;
    const pattern = new URLPattern({ pathname: route.path });
    const match = pattern.exec({ pathname });
    if (match) {
      return {
        handler: route.handler,
        params: match.pathname.groups as Record<string, string>,
      };
    }
  }
  return null;
}

// ---- 请求体解析 ----

export async function parseBody<T = any>(request: Request): Promise<T> {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return request.json() as Promise<T>;
  }
  throw new Error('Unsupported content type');
}

// ---- 时间格式化 ----

export function unixNow(): number {
  return Math.floor(Date.now() / 1000);
}

// ---- Admin Action Token (HMAC-SHA256) ----

/**
 * Generate an HMAC-SHA256 action token: base64url(HMAC-SHA256(id + action, secret))
 */
export async function generateActionToken(
  id: string,
  action: string,
  secret: string
): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(id + action));
  return base64UrlEncode(new Uint8Array(signature));
}

/**
 * Verify an admin action token
 */
export async function verifyActionToken(
  id: string,
  action: string,
  secret: string,
  token: string
): Promise<boolean> {
  const expected = await generateActionToken(id, action, secret);
  return expected === token;
}

// ---- D1辅助 ----

export function d1FirstRow<T>(result: D1Result): T | null {
  return (result.results?.[0] as T) ?? null;
}

// ---- Books Cache Version (KV) ----

export async function getBooksCacheVersion(kv: KVNamespace): Promise<number> {
  const raw = await kv.get(BOOKS_CACHE_VERSION_KEY);
  const parsed = raw ? parseInt(raw, 10) : 1;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export async function bumpBooksCacheVersion(kv: KVNamespace): Promise<number> {
  const current = await getBooksCacheVersion(kv);
  const next = current + 1;
  await kv.put(BOOKS_CACHE_VERSION_KEY, `${next}`);
  return next;
}
