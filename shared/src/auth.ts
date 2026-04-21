// ============================================
// 认证中间件
// ============================================

import { verifyJWT } from './utils';
import type { JWTPayload, User } from './types';

export interface AuthContext {
  user: JWTPayload;
  userId: string;
  isAdmin: boolean;
}

/**
 * 从请求中提取并验证JWT
 */
export async function authenticate(
  request: Request,
  jwtSecret: string
): Promise<AuthContext | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  const payload = await verifyJWT(token, jwtSecret);

  if (!payload) {
    return null;
  }

  const user = payload as unknown as JWTPayload;

  return {
    user,
    userId: user.sub,
    isAdmin: user.role === 'admin',
  };
}

/**
 * 要求必须登录
 */
export async function requireAuth(
  request: Request,
  jwtSecret: string
): Promise<AuthContext> {
  const auth = await authenticate(request, jwtSecret);
  if (!auth) {
    throw new Error('UNAUTHORIZED');
  }
  return auth;
}

/**
 * 要求必须是管理员
 */
export async function requireAdmin(
  request: Request,
  jwtSecret: string
): Promise<AuthContext> {
  const auth = await requireAuth(request, jwtSecret);
  if (!auth.isAdmin) {
    throw new Error('FORBIDDEN');
  }
  return auth;
}

/**
 * 可选认证 — 登录了就返回用户信息，没登录就返回null
 */
export async function optionalAuth(
  request: Request,
  jwtSecret: string
): Promise<AuthContext | null> {
  try {
    return await authenticate(request, jwtSecret);
  } catch {
    return null;
  }
}
