import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';

export interface DocNode {
  name: string;
  type: 'file' | 'folder';
  path: string; // 相对仓库根，以 / 开头，如 /ops/deploy.md
  children?: DocNode[];
}

const REPO = config.repoPath;

/** 仓库内忽略的目录/文件 */
const IGNORED = new Set(['.git', '.tomo', 'node_modules', '.DS_Store']);

/**
 * 把外部传入的相对路径解析为仓库内的绝对路径，并防止 path traversal。
 * 抛错表示路径越界。
 */
export function resolveRepoPath(relPath: string): string {
  const clean = relPath.replace(/^\/+/, '');
  const abs = path.resolve(REPO, clean);
  const repoWithSep = REPO.endsWith(path.sep) ? REPO : REPO + path.sep;
  if (abs !== REPO && !abs.startsWith(repoWithSep)) {
    throw new Error(`path traversal blocked: ${relPath}`);
  }
  return abs;
}

/** 转回相对仓库根的 POSIX 路径（以 / 开头） */
export function toRepoRelative(abs: string): string {
  const rel = path.relative(REPO, abs).split(path.sep).join('/');
  return '/' + rel;
}

/**
 * 递归构建文档树。纯文件系统读取，不碰 git —— 最快路径。
 * 只收集 .md 文件和包含 .md 的目录。
 */
export async function buildDocTree(dir: string = REPO): Promise<DocNode[]> {
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const nodes: DocNode[] = [];
  for (const entry of entries) {
    if (IGNORED.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const children = await buildDocTree(abs);
      if (children.length > 0) {
        nodes.push({
          name: entry.name,
          type: 'folder',
          path: toRepoRelative(abs),
          children,
        });
      }
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      nodes.push({
        name: entry.name,
        type: 'file',
        path: toRepoRelative(abs),
      });
    }
  }

  // 文件夹在前，同类按名称排序
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return nodes;
}

/** 读取单篇文档内容（文件系统直读，毫秒级） */
export async function readDoc(relPath: string): Promise<string> {
  const abs = resolveRepoPath(relPath);
  return fs.readFile(abs, 'utf-8');
}

/** 列出所有 .md 文件的相对路径（供搜索索引用） */
export async function listMarkdownFiles(dir: string = REPO): Promise<string[]> {
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    if (IGNORED.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listMarkdownFiles(abs)));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(toRepoRelative(abs));
    }
  }
  return files;
}
