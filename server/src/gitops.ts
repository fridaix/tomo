import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import git from 'isomorphic-git';
import { config } from './config.js';
import { resolveRepoPath } from './repo.js';

const REPO = config.repoPath;
const author = {
  name: config.git.authorName,
  email: config.git.authorEmail,
};

/** 写操作串行化队列：避免并发 commit 损坏 git 状态 */
let writeChain: Promise<unknown> = Promise.resolve();
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = writeChain.then(task, task);
  // 不让队列因单次失败而中断
  writeChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/** 确保仓库存在且已 git init */
export async function ensureRepo(): Promise<void> {
  await fsp.mkdir(REPO, { recursive: true });
  const gitDir = path.join(REPO, '.git');
  if (!fs.existsSync(gitDir)) {
    await git.init({ fs, dir: REPO, defaultBranch: 'main' });
  }
}

export interface SaveResult {
  ok: boolean;
  conflict?: boolean;
  oid?: string; // 新文件 blob sha
  commit?: string;
  currentOid?: string; // 冲突时的远端当前 sha
}

/** 取某个文件当前的 blob sha（不存在返回 null） */
export async function fileOid(relPath: string): Promise<string | null> {
  const abs = resolveRepoPath(relPath);
  try {
    const content = await fsp.readFile(abs);
    const oid = await git.hashBlob({ object: content });
    return oid.oid;
  } catch {
    return null;
  }
}

/**
 * 保存文档并生成 commit。
 * baseOid: 前端打开文档时的 blob sha，用于乐观锁冲突检测。
 *   - 传 null 表示新建文件
 *   - 不传（undefined）表示跳过冲突检测，强制覆盖
 */
export async function saveDoc(
  relPath: string,
  content: string,
  baseOid?: string | null
): Promise<SaveResult> {
  return enqueue(async () => {
    const abs = resolveRepoPath(relPath);

    // 冲突检测：当前磁盘版本与前端基线不一致则拒绝
    if (baseOid !== undefined) {
      const current = await fileOid(relPath);
      if (current !== baseOid) {
        return { ok: false, conflict: true, currentOid: current ?? undefined };
      }
    }

    await fsp.mkdir(path.dirname(abs), { recursive: true });
    await fsp.writeFile(abs, content, 'utf-8');

    const gitPath = relPath.replace(/^\/+/, '');
    await git.add({ fs, dir: REPO, filepath: gitPath });
    const commit = await git.commit({
      fs,
      dir: REPO,
      message: `docs: update ${gitPath}`,
      author,
    });

    const newOid = (await fileOid(relPath)) ?? undefined;
    return { ok: true, oid: newOid, commit };
  });
}

/** 删除文档并 commit */
export async function deleteDoc(relPath: string): Promise<{ ok: boolean; commit?: string }> {
  return enqueue(async () => {
    const abs = resolveRepoPath(relPath);
    const gitPath = relPath.replace(/^\/+/, '');
    await fsp.rm(abs, { force: true });
    await git.remove({ fs, dir: REPO, filepath: gitPath });
    const commit = await git.commit({
      fs,
      dir: REPO,
      message: `docs: delete ${gitPath}`,
      author,
    });
    return { ok: true, commit };
  });
}

export interface MoveResult {
  ok: boolean;
  error?: 'source_missing' | 'target_exists';
  commit?: string;
  oid?: string;
}

/**
 * 重命名 / 移动文档。git 没有原生 move，本质是删旧 + 加新 + commit。
 * 目标已存在时拒绝，避免覆盖。
 */
export async function moveDoc(fromPath: string, toPath: string): Promise<MoveResult> {
  return enqueue(async () => {
    const fromAbs = resolveRepoPath(fromPath);
    const toAbs = resolveRepoPath(toPath);
    const fromGit = fromPath.replace(/^\/+/, '');
    const toGit = toPath.replace(/^\/+/, '');

    if (!fs.existsSync(fromAbs)) {
      return { ok: false, error: 'source_missing' };
    }
    if (fs.existsSync(toAbs)) {
      return { ok: false, error: 'target_exists' };
    }

    const content = await fsp.readFile(fromAbs);
    await fsp.mkdir(path.dirname(toAbs), { recursive: true });
    await fsp.writeFile(toAbs, content);
    await fsp.rm(fromAbs, { force: true });

    await git.remove({ fs, dir: REPO, filepath: fromGit });
    await git.add({ fs, dir: REPO, filepath: toGit });
    const commit = await git.commit({
      fs,
      dir: REPO,
      message: `docs: move ${fromGit} -> ${toGit}`,
      author,
    });

    const oid = (await git.hashBlob({ object: content })).oid;
    return { ok: true, commit, oid };
  });
}

export interface CreateResult {
  ok: boolean;
  error?: 'exists';
  commit?: string;
  oid?: string;
}

/** 新建文档。已存在则拒绝（避免误覆盖）。 */
export async function createDoc(relPath: string, content = ''): Promise<CreateResult> {
  return enqueue(async () => {
    const abs = resolveRepoPath(relPath);
    const gitPath = relPath.replace(/^\/+/, '');
    if (fs.existsSync(abs)) {
      return { ok: false, error: 'exists' };
    }
    await fsp.mkdir(path.dirname(abs), { recursive: true });
    await fsp.writeFile(abs, content, 'utf-8');
    await git.add({ fs, dir: REPO, filepath: gitPath });
    const commit = await git.commit({
      fs,
      dir: REPO,
      message: `docs: create ${gitPath}`,
      author,
    });
    const oid = (await git.hashBlob({ object: Buffer.from(content, 'utf-8') })).oid;
    return { ok: true, commit, oid };
  });
}

export interface UploadResult {
  ok: boolean;
  path: string; // 仓库内相对路径，如 /assets/ab/cd1234.png
  url: string; // 前端可访问的 URL
}

/**
 * 保存上传的附件到仓库 assets/ 目录并 commit。
 * 用内容哈希命名（同图去重，避免覆盖冲突），按前两位分桶避免单目录文件过多。
 */
export async function saveAsset(
  data: Buffer,
  ext: string
): Promise<UploadResult> {
  return enqueue(async () => {
    const oid = (await git.hashBlob({ object: data })).oid;
    const safeExt = ext.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin';
    const relPath = `/assets/${oid.slice(0, 2)}/${oid.slice(2)}.${safeExt}`;
    const abs = resolveRepoPath(relPath);
    const gitPath = relPath.replace(/^\/+/, '');
    const url = `/api/asset?path=${encodeURIComponent(relPath)}`;

    // 已存在（同内容）则直接复用，不重复 commit
    if (fs.existsSync(abs)) {
      return { ok: true, path: relPath, url };
    }

    await fsp.mkdir(path.dirname(abs), { recursive: true });
    await fsp.writeFile(abs, data);
    await git.add({ fs, dir: REPO, filepath: gitPath });
    await git.commit({
      fs,
      dir: REPO,
      message: `docs: add asset ${gitPath}`,
      author,
    });
    return { ok: true, path: relPath, url };
  });
}

export interface Revision {
  commit: string;
  message: string;
  author: string;
  timestamp: number; // 秒
}

/**
 * 查某篇文档的历史版本。按文件查 git log —— 比扫全仓库快。
 * 一个 commit 算作该文件的一次修订，当且仅当该文件 blob 与其父 commit 不同。
 */
export async function docHistory(relPath: string, depth = 50): Promise<Revision[]> {
  const gitPath = relPath.replace(/^\/+/, '');
  const commits = await git.log({ fs, dir: REPO, depth });

  // 预取每个 commit 下该文件的 blob oid（null 表示当时不存在）
  const oids: (string | null)[] = [];
  for (const entry of commits) {
    oids.push(await blobOidAtCommit(entry.oid, gitPath));
  }

  const result: Revision[] = [];
  for (let i = 0; i < commits.length; i++) {
    const oid = oids[i];
    if (oid === null) continue; // 该 commit 时文件不存在
    const parentOid = i + 1 < commits.length ? oids[i + 1] : null;
    if (oid !== parentOid) {
      const entry = commits[i];
      result.push({
        commit: entry.oid,
        message: entry.commit.message.trim(),
        author: entry.commit.author.name,
        timestamp: entry.commit.author.timestamp,
      });
    }
  }
  return result;
}

/** 读取某个 commit 下某文件的内容（历史版本查看/恢复用） */
export async function readDocAtCommit(relPath: string, commitOid: string): Promise<string | null> {
  const gitPath = relPath.replace(/^\/+/, '');
  try {
    const { blob } = await git.readBlob({
      fs,
      dir: REPO,
      oid: commitOid,
      filepath: gitPath,
    });
    return new TextDecoder('utf-8').decode(blob);
  } catch {
    return null;
  }
}

/** 取某 commit 下文件的 blob sha，不存在返回 null */
async function blobOidAtCommit(commitOid: string, gitPath: string): Promise<string | null> {
  try {
    const { oid } = await git.readBlob({
      fs,
      dir: REPO,
      oid: commitOid,
      filepath: gitPath,
    });
    return oid;
  } catch {
    return null;
  }
}
