import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const API_BASE = Constants.expoConfig?.extra?.apiBase || 'https://ainovel-api.waitli.workers.dev/api/v1';

class ApiClient {
  private token: string | null = null;

  async init() {
    this.token = await AsyncStorage.getItem('token');
  }

  private async request<T>(path: string, options: {
    method?: string;
    body?: any;
    auth?: boolean;
  } = {}): Promise<T> {
    const { method = 'GET', body, auth = true } = options;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (auth && this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
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

  // ---- Auth ----
  async register(username: string, email: string, password: string) {
    const data = await this.request<any>('/auth/register', {
      method: 'POST',
      body: { username, email, password },
      auth: false,
    });
    this.token = data.token;
    await AsyncStorage.setItem('token', data.token);
    return data;
  }

  async login(email: string, password: string) {
    const data = await this.request<any>('/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    });
    this.token = data.token;
    await AsyncStorage.setItem('token', data.token);
    return data;
  }

  async getMe() {
    return this.request<any>('/auth/me');
  }

  async logout() {
    this.token = null;
    await AsyncStorage.removeItem('token');
  }

  getToken() { return this.token; }

  // ---- Books ----
  async getBooks(params?: { genre?: string; status?: string; page?: number }) {
    const q = new URLSearchParams();
    if (params?.genre) q.set('genre', params.genre);
    if (params?.status) q.set('status', params.status);
    if (params?.page) q.set('page', String(params.page));
    const qs = q.toString();
    return this.request<any>(`/books${qs ? '?' + qs : ''}`, { auth: false });
  }

  async getBook(id: string) {
    return this.request<any>(`/books/${id}`, { auth: false });
  }

  async getChapters(bookId: string) {
    return this.request<any>(`/books/${bookId}/chapters`, { auth: false });
  }

  async getChapter(bookId: string, num: number) {
    return this.request<any>(`/books/${bookId}/chapters/${num}`, { auth: false });
  }

  async getDirections(chapterId: string) {
    return this.request<any>(`/chapters/${chapterId}/directions`);
  }

  // ---- Submissions ----
  async submitBook(data: any) {
    return this.request<any>('/submissions', { method: 'POST', body: data });
  }

  async getSubmissions(status?: string) {
    const qs = status ? `?status=${status}` : '';
    return this.request<any>(`/submissions${qs}`);
  }

  async getSubmission(id: string) {
    return this.request<any>(`/submissions/${id}`);
  }

  async approveSubmission(id: string) {
    return this.request<any>(`/submissions/${id}/approve`, { method: 'POST' });
  }

  async rejectSubmission(id: string, reason?: string) {
    return this.request<any>(`/submissions/${id}/reject`, { method: 'POST', body: { reason } });
  }

  // ---- Voting ----
  async vote(directionId: string) {
    return this.request<any>('/votes', { method: 'POST', body: { direction_id: directionId } });
  }

  // ---- Characters ----
  async applyCharacter(bookId: string, character: any) {
    return this.request<any>(`/books/${bookId}/characters/apply`, { method: 'POST', body: character });
  }

  async getCharacterApplications(bookId: string, status?: string) {
    const qs = status ? `?status=${status}` : '';
    return this.request<any>(`/books/${bookId}/characters/applications${qs}`);
  }

  async approveCharacter(appId: string) {
    return this.request<any>(`/characters/applications/${appId}/approve`, { method: 'POST' });
  }

  async rejectCharacter(appId: string, reason?: string) {
    return this.request<any>(`/characters/applications/${appId}/reject`, { method: 'POST', body: { reason } });
  }

  async getBookCharacters(bookId: string) {
    return this.request<any>(`/books/${bookId}/characters`);
  }

  async getMyApplications() {
    return this.request<any>('/characters/applications/my');
  }
}

export const api = new ApiClient();
