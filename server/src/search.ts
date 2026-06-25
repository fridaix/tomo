import { listMarkdownFiles, readDoc } from './repo.js';

export interface SearchHit {
  path: string;
  title: string;
  snippet: string;
  score: number;
}

interface IndexEntry {
  path: string;
  title: string;
  content: string;
  lower: string; // 小写正文，加速匹配
}

/**
 * 内存搜索索引。可重建缓存，不是文档主数据——
 * 服务重启时从仓库重新扫描构建即可。
 */
let index: IndexEntry[] = [];
let building: Promise<void> | null = null;

function extractTitle(path: string, content: string): string {
  const m = content.match(/^#\s+(.+)$/m);
  if (m) return m[1].replace(/[*_`]/g, '').trim();
  const name = path.split('/').pop() ?? path;
  return name.replace(/\.md$/, '');
}

export async function rebuildIndex(): Promise<void> {
  if (building) return building;
  building = (async () => {
    const files = await listMarkdownFiles();
    const next: IndexEntry[] = [];
    for (const path of files) {
      try {
        const content = await readDoc(path);
        next.push({
          path,
          title: extractTitle(path, content),
          content,
          lower: content.toLowerCase(),
        });
      } catch {
        // 跳过读不到的文件
      }
    }
    index = next;
  })();
  try {
    await building;
  } finally {
    building = null;
  }
}

/** 增量更新单篇（保存后调用，避免全量重建） */
export function updateIndexEntry(path: string, content: string): void {
  const entry: IndexEntry = {
    path,
    title: extractTitle(path, content),
    content,
    lower: content.toLowerCase(),
  };
  const i = index.findIndex((e) => e.path === path);
  if (i >= 0) index[i] = entry;
  else index.push(entry);
}

export function removeIndexEntry(path: string): void {
  index = index.filter((e) => e.path !== path);
}

function makeSnippet(content: string, qLower: string): string {
  const pos = content.toLowerCase().indexOf(qLower);
  if (pos < 0) return content.slice(0, 120).replace(/\n/g, ' ').trim();
  const start = Math.max(0, pos - 40);
  const end = Math.min(content.length, pos + qLower.length + 80);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < content.length ? '…' : '';
  return prefix + content.slice(start, end).replace(/\n/g, ' ').trim() + suffix;
}

/** 简单全文搜索：标题命中权重高于正文 */
export function search(query: string, limit = 20): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const hits: SearchHit[] = [];
  for (const entry of index) {
    const titleHit = entry.title.toLowerCase().includes(q);
    const bodyPos = entry.lower.indexOf(q);
    if (!titleHit && bodyPos < 0) continue;

    // 计分：标题命中 +10，正文每次命中 +1
    let score = titleHit ? 10 : 0;
    let idx = entry.lower.indexOf(q);
    while (idx >= 0) {
      score += 1;
      idx = entry.lower.indexOf(q, idx + q.length);
    }

    hits.push({
      path: entry.path,
      title: entry.title,
      snippet: makeSnippet(entry.content, q),
      score,
    });
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}
