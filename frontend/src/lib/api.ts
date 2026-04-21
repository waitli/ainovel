// ============================================
// API 客户端 — 封装所有后端接口
// ============================================

const API_BASE = '/api/v1';

interface ApiOptions {
  method?: string;
  body?: any;
  token?: string;
}

class ApiClient {
  private token: string | null = null;

  constructor() {
    // 从 localStorage 恢复 token
    this.token = localStorage.getItem('ainovel_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('ainovel_token', token);
    } else {
      localStorage.removeItem('ainovel_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(path: string, options: ApiOptions = {}): Promise<T> {
    const { method = 'GET', body, token } = options;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const authToken = token || this.token;
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Request failed');
    }

    return data.data;
  }

  // ---- 认证 ----
  async register(username: string, email: string, password: string) {
    const data = await this.request<any>('/auth/register', {
      method: 'POST',
      body: { username, email, password },
    });
    this.setToken(data.token);
    return data;
  }

  async login(email: string, password: string) {
    const data = await this.request<any>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    this.setToken(data.token);
    return data;
  }

  async getMe() {
    return this.request<any>('/auth/me');
  }

  logout() {
    this.setToken(null);
  }

  // ---- 书目 ----
  async getBooks(params?: { genre?: string; status?: string; page?: number }) {
    const query = new URLSearchParams();
    if (params?.genre) query.set('genre', params.genre);
    if (params?.status) query.set('status', params.status || 'active');
    if (params?.page) query.set('page', String(params.page));
    const qs = query.toString();
    return this.request<any>(`/books${qs ? '?' + qs : ''}`);
  }

  async getBook(id: string) {
    return this.request<any>(`/books/${id}`);
  }

  async getChapters(bookId: string) {
    return this.request<any>(`/books/${bookId}/chapters`);
  }

  async getChapter(bookId: string, chapterNum: number) {
    return this.request<any>(`/books/${bookId}/chapters/${chapterNum}`);
  }

  // ---- 投稿 ----
  async submitBook(data: {
    title: string;
    genre: string;
    worldview: string;
    characters: any[];
    outline: string;
    core_conflict: string;
    tone?: string;
    target_chapters?: number;
    additional_notes?: string;
  }) {
    return this.request<any>('/submissions', {
      method: 'POST',
      body: data,
    });
  }

  async getSubmissions(status?: string) {
    const qs = status ? `?status=${status}` : '';
    return this.request<any>(`/submissions${qs}`);
  }

  async approveSubmission(id: string) {
    return this.request<any>(`/submissions/${id}/approve`, { method: 'POST' });
  }

  async rejectSubmission(id: string, reason?: string) {
    return this.request<any>(`/submissions/${id}/reject`, {
      method: 'POST',
      body: { reason },
    });
  }

  // ---- 投票 ----
  async vote(directionId: string) {
    return this.request<any>('/votes', {
      method: 'POST',
      body: { direction_id: directionId },
    });
  }

  async getDirections(chapterId: string) {
    return this.request<any>(`/chapters/${chapterId}/directions`);
  }

  // ---- 角色申请 ----
  async applyCharacter(bookId: string, character: any) {
    return this.request<any>(`/books/${bookId}/characters/apply`, {
      method: 'POST',
      body: character,
    });
  }

  async getMyApplications() {
    return this.request<any>('/characters/applications/my');
  }
}

export const api = new ApiClient();
