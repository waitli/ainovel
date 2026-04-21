const API = 'https://api.ainovel.waitli.top/api/v1';

class Api {
  private token = localStorage.getItem('token');

  private async req<T>(path: string, opts: { method?: string; body?: any; auth?: boolean } = {}): Promise<T> {
    const { method = 'GET', body, auth = true } = opts;
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (auth && this.token) h['Authorization'] = `Bearer ${this.token}`;
    const r = await fetch(`${API}${path}`, { method, headers: h, body: body && JSON.stringify(body) });
    const d = await r.json();
    if (!d.success) throw new Error(d.error || 'Request failed');
    return d.data;
  }

  async register(u: string, e: string, p: string, c: string) {
    const d = await this.req<any>('/auth/register', { method: 'POST', body: { username: u, email: e, password: p, code: c }, auth: false });
    this.token = d.token; localStorage.setItem('token', d.token); return d;
  }
  async sendCode(email: string) {
    return this.req<any>('/auth/send-code', { method: 'POST', body: { email }, auth: false });
  }
  async login(e: string, p: string) {
    const d = await this.req<any>('/auth/login', { method: 'POST', body: { email: e, password: p }, auth: false });
    this.token = d.token; localStorage.setItem('token', d.token); return d;
  }
  async me() { return this.req<any>('/auth/me'); }
  logout() { this.token = null; localStorage.removeItem('token'); }
  getToken() { return this.token; }

  async getBooks(p?: any) {
    // 如果没显式传 lang，才从 localStorage 读取
    const lang = (p && 'lang' in p) ? p.lang : (localStorage.getItem('lang') || 'en');
    const params = { ...p, lang };
    const q = new URLSearchParams(params).toString();
    return this.req<any>(`/books${q ? '?' + q : ''}`, { auth: false });
  }
  async getBook(id: string) { return this.req<any>(`/books/${id}`, { auth: false }); }
  getCoverUrl(id: string) { return `${API}/books/${id}/cover`; }
  async getChapters(bid: string) { return this.req<any>(`/books/${bid}/chapters`, { auth: false }); }
  async getChapter(bid: string, n: number) { return this.req<any>(`/books/${bid}/chapters/${n}`, { auth: false }); }
  async getDirections(cid: string) { return this.req<any>(`/chapters/${cid}/directions`); }

  async submit(d: any) { return this.req<any>('/submissions', { method: 'POST', body: d }); }
  async getSubmissions(s?: string) { return this.req<any>(`/submissions${s ? '?status=' + s : ''}`); }
  async getSubmission(id: string) { return this.req<any>(`/submissions/${id}`); }
  async approve(id: string) { return this.req<any>(`/submissions/${id}/approve`, { method: 'POST' }); }
  async reject(id: string, r?: string) { return this.req<any>(`/submissions/${id}/reject`, { method: 'POST', body: { reason: r } }); }

  async vote(did: string) { return this.req<any>('/votes', { method: 'POST', body: { direction_id: did } }); }

  async applyChar(bid: string, c: any) { return this.req<any>(`/books/${bid}/characters/apply`, { method: 'POST', body: c }); }
  async getCharApps(bid: string, s?: string) { return this.req<any>(`/books/${bid}/characters/applications${s ? '?status=' + s : ''}`); }
  async approveChar(aid: string) { return this.req<any>(`/characters/applications/${aid}/approve`, { method: 'POST' }); }
  async rejectChar(aid: string, r?: string) { return this.req<any>(`/characters/applications/${aid}/reject`, { method: 'POST', body: { reason: r } }); }
  async getBookChars(bid: string) { return this.req<any>(`/books/${bid}/characters`); }

  // admin
  async deleteBook(id: string) { return this.req<any>(`/admin/books/${id}`, { method: 'DELETE' }); }
  async getUsers() { return this.req<any>('/admin/users'); }
  async updateUserRole(id: string, role: string) { return this.req<any>(`/admin/users/${id}/role`, { method: 'PUT', body: { role } }); }
  async deleteUser(id: string) { return this.req<any>(`/admin/users/${id}`, { method: 'DELETE' }); }
}

export const api = new Api();
