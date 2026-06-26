import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { config } from './config.js';

export type Role = 'reader' | 'writer';

export interface User {
  username: string;
  role: Role;
}

interface StoredUser extends User {
  passwordHash: string;
}

const FILE = config.usersFile;
const BCRYPT_ROUNDS = 10;

/** 写操作串行化，避免并发写 JSON 互相覆盖 */
let chain: Promise<unknown> = Promise.resolve();
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(task, task);
  chain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function readAll(): Promise<StoredUser[]> {
  try {
    const raw = await fsp.readFile(FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredUser[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(users: StoredUser[]): Promise<void> {
  await fsp.mkdir(path.dirname(FILE), { recursive: true });
  await fsp.writeFile(FILE, JSON.stringify(users, null, 2), 'utf-8');
}

function publicUser(u: StoredUser): User {
  return { username: u.username, role: u.role };
}

/** 首次启动：无用户则创建种子管理员 */
export async function ensureSeedAdmin(): Promise<void> {
  await enqueue(async () => {
    if (fs.existsSync(FILE)) {
      const users = await readAll();
      if (users.length > 0) return;
    }
    const { username, password } = config.seedAdmin;
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await writeAll([{ username, role: 'writer', passwordHash }]);
    console.log(`Seeded admin user "${username}" (please change the password)`);
  });
}

/** 校验用户名密码，成功返回公开用户信息，失败返回 null */
export async function verifyCredentials(
  username: string,
  password: string
): Promise<User | null> {
  const users = await readAll();
  const found = users.find((u) => u.username === username);
  if (!found) {
    // 仍跑一次 hash 比较，降低用户名枚举的时序差异
    await bcrypt.compare(password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
    return null;
  }
  const ok = await bcrypt.compare(password, found.passwordHash);
  return ok ? publicUser(found) : null;
}

export async function getUser(username: string): Promise<User | null> {
  const users = await readAll();
  const found = users.find((u) => u.username === username);
  return found ? publicUser(found) : null;
}

export async function listUsers(): Promise<User[]> {
  const users = await readAll();
  return users.map(publicUser);
}

export async function createUser(
  username: string,
  password: string,
  role: Role
): Promise<{ ok: boolean; error?: 'exists' | 'invalid' }> {
  if (!username || !password) return { ok: false, error: 'invalid' };
  return enqueue(async () => {
    const users = await readAll();
    if (users.some((u) => u.username === username)) {
      return { ok: false, error: 'exists' as const };
    }
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    users.push({ username, role, passwordHash });
    await writeAll(users);
    return { ok: true };
  });
}

export async function setPassword(
  username: string,
  password: string
): Promise<{ ok: boolean; error?: 'not_found' }> {
  return enqueue(async () => {
    const users = await readAll();
    const u = users.find((x) => x.username === username);
    if (!u) return { ok: false, error: 'not_found' as const };
    u.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await writeAll(users);
    return { ok: true };
  });
}

export async function setRole(
  username: string,
  role: Role
): Promise<{ ok: boolean; error?: 'not_found' | 'last_writer' }> {
  return enqueue(async () => {
    const users = await readAll();
    const u = users.find((x) => x.username === username);
    if (!u) return { ok: false, error: 'not_found' as const };
    // 不允许把最后一个 writer 降级为 reader
    if (u.role === 'writer' && role === 'reader') {
      const writers = users.filter((x) => x.role === 'writer');
      if (writers.length === 1) {
        return { ok: false, error: 'last_writer' as const };
      }
    }
    u.role = role;
    await writeAll(users);
    return { ok: true };
  });
}

export async function deleteUser(username: string): Promise<{ ok: boolean }> {
  return enqueue(async () => {
    const users = await readAll();
    const next = users.filter((u) => u.username !== username);
    await writeAll(next);
    return { ok: true };
  });
}
