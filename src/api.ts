export interface DocNode {
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: DocNode[];
}

export interface DocPayload {
  path: string;
  content: string;
  oid: string | null;
}

export interface Revision {
  commit: string;
  message: string;
  author: string;
  timestamp: number;
}

export interface SearchHit {
  path: string;
  title: string;
  snippet: string;
  score: number;
}

export interface SaveResult {
  ok: boolean;
  conflict?: boolean;
  oid?: string;
  commit?: string;
  currentOid?: string;
}

export interface UploadResult {
  ok: boolean;
  path: string;
  url: string;
}

export type Role = 'reader' | 'writer';

export interface User {
  username: string;
  role: Role;
}

const BASE = '/api';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(init?.headers as Record<string, string>),
  };

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include', // 携带会话 cookie
  });
  if (!res.ok && res.status !== 409) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export const api = {
  tree: () => req<{ tree: DocNode[] }>('/tree').then((r) => r.tree),

  doc: (path: string) =>
    req<DocPayload>(`/doc?path=${encodeURIComponent(path)}`),

  save: (path: string, content: string, baseOid: string | null | undefined) =>
    req<SaveResult>('/doc', {
      method: 'PUT',
      body: JSON.stringify({ path, content, baseOid }),
    }),

  create: (path: string, content = '') =>
    req<SaveResult & { error?: string }>('/doc', {
      method: 'POST',
      body: JSON.stringify({ path, content }),
    }),

  move: (from: string, to: string) =>
    req<{ ok: boolean; error?: string; commit?: string; oid?: string }>('/move', {
      method: 'POST',
      body: JSON.stringify({ from, to }),
    }),

  remove: (path: string) =>
    req<{ ok: boolean; commit?: string }>(
      `/doc?path=${encodeURIComponent(path)}`,
      { method: 'DELETE' }
    ),

  history: (path: string) =>
    req<{ revisions: Revision[] }>(
      `/history?path=${encodeURIComponent(path)}`
    ).then((r) => r.revisions),

  revision: (path: string, commit: string) =>
    req<{ content: string }>(
      `/revision?path=${encodeURIComponent(path)}&commit=${encodeURIComponent(commit)}`
    ).then((r) => r.content),

  search: (q: string) =>
    req<{ hits: SearchHit[] }>(`/search?q=${encodeURIComponent(q)}`).then(
      (r) => r.hits
    ),

  /** 上传图片附件（原始二进制） */
  upload: async (file: File): Promise<UploadResult> => {
    const res = await fetch(`${BASE}/upload`, {
      method: 'POST',
      headers: { 'content-type': file.type },
      body: file,
      credentials: 'include',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(res.status, body.error ?? res.statusText);
    }
    return res.json() as Promise<UploadResult>;
  },

  // === 认证 ===
  whoami: () => req<{ user: User | null }>('/whoami').then((r) => r.user),

  login: (username: string, password: string) =>
    req<{ user: User }>('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }).then((r) => r.user),

  logout: () => req<{ ok: boolean }>('/logout', { method: 'POST' }),

  // === 用户管理（仅 writer） ===
  listUsers: () => req<{ users: User[] }>('/users').then((r) => r.users),

  createUser: (username: string, password: string, role: Role) =>
    req<{ ok: boolean; error?: string }>('/users', {
      method: 'POST',
      body: JSON.stringify({ username, password, role }),
    }),

  setUserRole: (username: string, role: Role) =>
    req<{ ok: boolean; error?: string }>('/users/role', {
      method: 'PUT',
      body: JSON.stringify({ username, role }),
    }),

  setUserPassword: (username: string, password: string) =>
    req<{ ok: boolean; error?: string }>('/users/password', {
      method: 'PUT',
      body: JSON.stringify({ username, password }),
    }),

  deleteUser: (username: string) =>
    req<{ ok: boolean; error?: string }>(
      `/users?username=${encodeURIComponent(username)}`,
      { method: 'DELETE' }
    ),
};
