import type { BaseEnv, User } from '../../../shared/src/index';
import {
  generateId, unixNow, createJWT,
  successResponse, errorResponse, corsResponse,
  parseBody, d1FirstRow,
  requireAuth, requireAdmin,
  sendVerificationEmail,
} from '../../../shared/src/index';

interface AuthEnv extends BaseEnv {
  RESEND_API_KEY: string;
}

export default {
  async fetch(request: Request, env: AuthEnv): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    if (method === 'OPTIONS') return corsResponse();

    try {
      // POST /api/v1/auth/register
      if (method === 'POST' && pathname === '/api/v1/auth/register') {
        return await handleRegister(request, env);
      }

      // POST /api/v1/auth/send-code — 发送邮箱验证码
      if (method === 'POST' && pathname === '/api/v1/auth/send-code') {
        return await handleSendCode(request, env);
      }

      // POST /api/v1/auth/login
      if (method === 'POST' && pathname === '/api/v1/auth/login') {
        return await handleLogin(request, env);
      }

      // GET /api/v1/auth/me
      if (method === 'GET' && pathname === '/api/v1/auth/me') {
        return await handleMe(request, env);
      }

      // GET /api/v1/admin/users — 管理员获取用户列表
      if (method === 'GET' && pathname === '/api/v1/admin/users') {
        return await handleListUsers(request, env);
      }

      // PUT /api/v1/admin/users/:id/role — 管理员修改用户角色
      if (method === 'PUT' && pathname.match(/^\/api\/v1\/admin\/users\/[^/]+\/role$/)) {
        const userId = pathname.split('/')[5];
        return await handleUpdateRole(userId, request, env);
      }

      // DELETE /api/v1/admin/users/:id — 管理员删除用户
      if (method === 'DELETE' && pathname.match(/^\/api\/v1\/admin\/users\/[^/]+$/)) {
        const userId = pathname.split('/')[5];
        return await handleDeleteUser(userId, request, env);
      }

      return errorResponse('Not found', 404);

    } catch (err: any) {
      console.error('Auth Error:', err);
      return errorResponse('Internal server error', 500);
    }
  },
};

/**
 * 注册
 */
async function handleRegister(request: Request, env: AuthEnv): Promise<Response> {
  const body = await parseBody<{
    username: string;
    email: string;
    password: string;
    code: string;
  }>(request);

  if (!body.username || !body.email || !body.password || !body.code) {
    return errorResponse('username, email, password, code are required');
  }

  // 禁止用户名是邮箱格式（防止浏览器 autofill 错误）
  if (body.username.includes('@')) {
    return errorResponse('Username cannot be an email address');
  }

  if (body.password.length < 6) {
    return errorResponse('Password must be at least 6 characters');
  }

  // 验证邮箱验证码
  const storedCode = await env.KV.get(`verify:${body.email}`);
  if (!storedCode || storedCode !== body.code) {
    return errorResponse('Invalid or expired verification code');
  }
  // 验证通过，删除验证码
  await env.KV.delete(`verify:${body.email}`);

  // 检查是否已存在
  const existing = await env.DB.prepare(
    `SELECT id FROM users WHERE email = ? OR username = ?`
  ).bind(body.email, body.username).first();

  if (existing) {
    return errorResponse('Username or email already exists', 409);
  }

  const userId = generateId();
  const now = unixNow();

  // 哈希密码 (使用 Web Crypto)
  const passwordHash = await hashPassword(body.password);

  await env.DB.prepare(`
    INSERT INTO users (id, username, email, password_hash, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'reader', ?, ?)
  `).bind(userId, body.username, body.email, passwordHash, now, now).run();

  // 生成 JWT
  const token = await createJWT({
    sub: userId,
    username: body.username,
    role: 'reader',
    iat: now,
    exp: now + 86400 * 7, // 7天
  }, env.JWT_SECRET);

  return successResponse({
    user: { id: userId, username: body.username, email: body.email, role: 'reader' },
    token,
  }, 'Registration successful');
}

/**
 * 登录
 */
async function handleLogin(request: Request, env: AuthEnv): Promise<Response> {
  const body = await parseBody<{
    email: string;
    password: string;
  }>(request);

  if (!body.email || !body.password) {
    return errorResponse('email and password are required');
  }

  const user = await env.DB.prepare(
    `SELECT * FROM users WHERE email = ?`
  ).bind(body.email).first<User & { password_hash: string }>();

  if (!user) {
    return errorResponse('Invalid email or password', 401);
  }

  // 验证密码
  const valid = await verifyPassword(body.password, user.password_hash);
  if (!valid) {
    return errorResponse('Invalid email or password', 401);
  }

  const now = unixNow();
  const token = await createJWT({
    sub: user.id,
    username: user.username,
    role: user.role,
    iat: now,
    exp: now + 86400 * 7,
  }, env.JWT_SECRET);

  return successResponse({
    user: { id: user.id, username: user.username, email: user.email, role: user.role },
    token,
  }, 'Login successful');
}

/**
 * 获取当前用户信息
 */
async function handleMe(request: Request, env: AuthEnv): Promise<Response> {
  const auth = await requireAuth(request, env.JWT_SECRET);

  const user = await env.DB.prepare(
    `SELECT id, username, email, role, avatar_url, created_at FROM users WHERE id = ?`
  ).bind(auth.userId).first<User>();

  if (!user) return errorResponse('User not found', 404);

  return successResponse(user);
}

// ============================================
// 密码哈希 (Web Crypto API)
// ============================================

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // PBKDF2 with SHA-256
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );

  // Combine salt + hash
  const combined = new Uint8Array(16 + 32);
  combined.set(salt);
  combined.set(new Uint8Array(derivedBits), 16);

  return btoa(String.fromCharCode(...combined));
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const combined = new Uint8Array(
    atob(hash).split('').map(c => c.charCodeAt(0))
  );

  const salt = combined.slice(0, 16);
  const storedHash = combined.slice(16);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );

  const newHash = new Uint8Array(derivedBits);

  // Constant-time comparison
  if (newHash.length !== storedHash.length) return false;
  let result = 0;
  for (let i = 0; i < newHash.length; i++) {
    result |= newHash[i] ^ storedHash[i];
  }
  return result === 0;
}

/**
 * 管理员获取用户列表
 */
async function handleListUsers(request: Request, env: AuthEnv): Promise<Response> {
  await requireAdmin(request, env.JWT_SECRET);
  const result = await env.DB.prepare(
    'SELECT id, username, email, role, avatar_url, created_at FROM users ORDER BY created_at DESC LIMIT 200'
  ).all();
  return successResponse({ users: result.results });
}

/**
 * 管理员修改用户角色
 */
async function handleUpdateRole(userId: string, request: Request, env: AuthEnv): Promise<Response> {
  await requireAdmin(request, env.JWT_SECRET);
  const body = await parseBody<{ role: string }>(request);
  if (!body.role || !['reader', 'admin'].includes(body.role)) {
    return errorResponse('Invalid role: must be reader or admin');
  }
  await env.DB.prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?')
    .bind(body.role, unixNow(), userId).run();
  return successResponse({ id: userId, role: body.role }, 'Role updated');
}

/**
 * 发送邮箱验证码
 */
async function handleSendCode(request: Request, env: AuthEnv): Promise<Response> {
  const body = await parseBody<{ email: string }>(request);
  if (!body.email) return errorResponse('email is required');

  // 生成 6 位验证码
  const code = String(Math.floor(100000 + Math.random() * 900000));

  // 存入 KV，10 分钟过期
  await env.KV.put(`verify:${body.email}`, code, { expirationTtl: 600 });

  // 发送邮件
  await sendVerificationEmail({ RESEND_API_KEY: env.RESEND_API_KEY }, body.email, code);

  return successResponse({ message: 'Verification code sent' });
}

/**
 * 管理员删除用户
 */
async function handleDeleteUser(userId: string, request: Request, env: AuthEnv): Promise<Response> {
  const auth = await requireAdmin(request, env.JWT_SECRET);
  // 不能删除自己
  if (auth.userId === userId) return errorResponse('Cannot delete yourself');
  // 级联清理: 先处理外键引用，再删用户
  await env.DB.prepare('DELETE FROM votes WHERE user_id = ?').bind(userId).run();
  await env.DB.prepare('DELETE FROM character_applications WHERE applicant_id = ?').bind(userId).run();
  // 转移书籍所有权到当前管理员
  await env.DB.prepare('UPDATE books SET submitted_by = ? WHERE submitted_by = ?').bind(auth.userId, userId).run();
  await env.DB.prepare('UPDATE books SET approved_by = NULL WHERE approved_by = ?').bind(userId).run();
  await env.DB.prepare('UPDATE character_applications SET reviewed_by = NULL WHERE reviewed_by = ?').bind(userId).run();
  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
  return successResponse({ id: userId }, 'User deleted');
}
