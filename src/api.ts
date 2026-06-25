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

const BASE = '/api';

/** 可选的共享密码，存在内存里（登录后设置） */
let password = '';
export function setPassword(p: string): void {
  password = p;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(init?.headers as Record<string, string>),
  };
  if (password) headers['x-tomo-password'] = password;

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
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
};
