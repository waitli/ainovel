// ============================================
// 投票系统 — Durable Object (实时投票计数)
// ============================================
// 每个章节有独立的 VoteCounter 实例
// 用 DO 的单线程保证投票计数无并发冲突
// ============================================

import type { VoteCounterState } from '../../../shared/src/index';
import { VOTE_THRESHOLD as DEFAULT_VOTE_THRESHOLD } from '../../../shared/src/index';

export class VoteCounter {
  state: DurableObjectState;
  env: any;
  storage: DurableObjectStorage;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
    this.storage = state.storage;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // POST /vote — 投票
      if (request.method === 'POST' && path === '/vote') {
        return await this.handleVote(request);
      }

      // GET /status — 获取投票状态
      if (request.method === 'GET' && path === '/status') {
        return await this.handleStatus();
      }

      // POST /init — 初始化投票计数器
      if (request.method === 'POST' && path === '/init') {
        return await this.handleInit(request);
      }

      return new Response('Not found', { status: 404 });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  /**
   * 初始化投票计数器
   */
  async handleInit(request: Request): Promise<Response> {
    const body = await request.json() as {
      chapter_id: string;
      book_id: string;
      direction_ids: string[];
      threshold: number;
    };

    const state: VoteCounterState = {
      chapter_id: body.chapter_id,
      book_id: body.book_id,
      direction_counts: Object.fromEntries(
        body.direction_ids.map(id => [id, 0])
      ),
      total_votes: 0,
      threshold: body.threshold,
      is_triggered: false,
    };

    await this.storage.put('state', state);

    return new Response(JSON.stringify({ success: true, state }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * 投票
   */
  async handleVote(request: Request): Promise<Response> {
    const body = await request.json() as {
      user_id: string;
      direction_id: string;
    };

    let state = await this.storage.get<VoteCounterState>('state');

    // 如果未初始化，自动初始化 (从 D1 查方向)
    if (!state) {
      const configuredThreshold = parseInt(
        this.env?.VOTE_THRESHOLD || `${DEFAULT_VOTE_THRESHOLD}`,
        10
      );
      state = {
        chapter_id: '',
        book_id: '',
        direction_counts: {},
        total_votes: 0,
        threshold: Number.isFinite(configuredThreshold) ? configuredThreshold : DEFAULT_VOTE_THRESHOLD,
        is_triggered: false,
      };
      await this.storage.put('state', state);
    }

    if (state.is_triggered) {
      return new Response(JSON.stringify({
        error: 'Voting already completed for this chapter',
        triggered: true,
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!(body.direction_id in state.direction_counts)) {
      // 自动添加新方向
      state.direction_counts[body.direction_id] = 0;
    }

    // 检查用户是否已投票 (通过 D1 查)
    // 这里只做计数，重复投票的去重逻辑在 Worker 入口处理

    // 计数 +1
    state.direction_counts[body.direction_id]++;
    state.total_votes++;

    // 检查是否达到门槛
    let shouldTrigger = false;
    let winningDirection: string | null = null;

    for (const [dirId, count] of Object.entries(state.direction_counts)) {
      if (count >= state.threshold) {
        shouldTrigger = true;
        winningDirection = dirId;
        state.is_triggered = true;
        break;
      }
    }

    await this.storage.put('state', state);

    return new Response(JSON.stringify({
      success: true,
      state,
      should_trigger: shouldTrigger,
      winning_direction: winningDirection,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * 获取当前投票状态
   */
  async handleStatus(): Promise<Response> {
    const state = await this.storage.get<VoteCounterState>('state');
    if (!state) {
      return new Response(JSON.stringify({ error: 'Not initialized' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, state }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
