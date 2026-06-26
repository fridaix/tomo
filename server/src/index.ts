import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { config } from './config.js';
import { requireAuth, requireWriter } from './auth.js';
import {
  ensureSeedAdmin,
  verifyCredentials,
  listUsers,
  createUser,
  setPassword,
  setRole,
  deleteUser,
} from './users.js';
import { buildDocTree, readDoc, readBinary } from './repo.js';
import {
  ensureRepo,
  fileOid,
  saveDoc,
  deleteDoc,
  moveDoc,
  createDoc,
  saveAsset,
  docHistory,
  readDocAtCommit,
} from './gitops.js';
import {
  rebuildIndex,
  search,
  updateIndexEntry,
  removeIndexEntry,
} from './search.js';

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 14, // 14 天
    },
  })
);

/** 允许的图片类型 -> 扩展名 */
const IMAGE_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};
const MAX_ASSET_BYTES = 10 * 1024 * 1024; // 10MB

/** 包装 async 路由，统一捕获异常 */
type Handler = (req: express.Request, res: express.Response) => Promise<void>;
const wrap =
  (fn: Handler) =>
  (req: express.Request, res: express.Response): void => {
    fn(req, res).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : 'internal error';
      const code = msg.includes('path traversal') ? 400 : 500;
      res.status(code).json({ error: msg });
    });
  };

// 健康检查（不鉴权）
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, repo: config.repoPath });
});

// === 认证路由（不需要预先登录） ===

// 登录
app.post(
  '/api/login',
  wrap(async (req, res) => {
    const { username, password } = req.body ?? {};
    if (typeof username !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'username and password required' });
      return;
    }
    const user = await verifyCredentials(username, password);
    if (!user) {
      res.status(401).json({ error: 'invalid credentials' });
      return;
    }
    req.session.user = user;
    res.json({ user });
  })
);

// 登出
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

// 当前登录用户
app.get('/api/whoami', (req, res) => {
  res.json({ user: req.session?.user ?? null });
});

// === 以下读接口需要登录 ===

// 文档树
app.get(
  '/api/tree',
  requireAuth,
  wrap(async (_req, res) => {
    const tree = await buildDocTree();
    res.json({ tree });
  })
);

// 读单篇文档（含当前 blob sha，供前端保存时做冲突检测）
app.get(
  '/api/doc',
  requireAuth,
  wrap(async (req, res) => {
    const path = String(req.query.path ?? '');
    if (!path) {
      res.status(400).json({ error: 'missing path' });
      return;
    }
    try {
      const content = await readDoc(path);
      const oid = await fileOid(path);
      res.json({ path, content, oid });
    } catch {
      res.status(404).json({ error: 'not found' });
    }
  })
);

// 保存文档（带冲突检测）
app.put(
  '/api/doc',
  requireWriter,
  wrap(async (req, res) => {
    const { path, content, baseOid } = req.body ?? {};
    if (typeof path !== 'string' || typeof content !== 'string') {
      res.status(400).json({ error: 'path and content required' });
      return;
    }
    const result = await saveDoc(path, content, baseOid);
    if (!result.ok && result.conflict) {
      res.status(409).json(result);
      return;
    }
    updateIndexEntry(path, content);
    res.json(result);
  })
);

// 删除文档
app.delete(
  '/api/doc',
  requireWriter,
  wrap(async (req, res) => {
    const path = String(req.query.path ?? '');
    if (!path) {
      res.status(400).json({ error: 'missing path' });
      return;
    }
    const result = await deleteDoc(path);
    removeIndexEntry(path);
    res.json(result);
  })
);

// 新建文档
app.post(
  '/api/doc',
  requireWriter,
  wrap(async (req, res) => {
    const { path, content } = req.body ?? {};
    if (typeof path !== 'string' || !path) {
      res.status(400).json({ error: 'path required' });
      return;
    }
    if (!path.endsWith('.md')) {
      res.status(400).json({ error: 'path must end with .md' });
      return;
    }
    const result = await createDoc(path, typeof content === 'string' ? content : '');
    if (!result.ok && result.error === 'exists') {
      res.status(409).json(result);
      return;
    }
    updateIndexEntry(path, typeof content === 'string' ? content : '');
    res.status(201).json(result);
  })
);

// 重命名 / 移动文档
app.post(
  '/api/move',
  requireWriter,
  wrap(async (req, res) => {
    const { from, to } = req.body ?? {};
    if (typeof from !== 'string' || typeof to !== 'string' || !from || !to) {
      res.status(400).json({ error: 'from and to required' });
      return;
    }
    if (!to.endsWith('.md')) {
      res.status(400).json({ error: 'target must end with .md' });
      return;
    }
    const result = await moveDoc(from, to);
    if (!result.ok) {
      const code = result.error === 'target_exists' ? 409 : 404;
      res.status(code).json(result);
      return;
    }
    // 更新搜索索引：移除旧路径，加入新路径
    removeIndexEntry(from);
    try {
      const content = await readDoc(to);
      updateIndexEntry(to, content);
    } catch {
      // 读不到就跳过索引更新
    }
    res.json(result);
  })
);

// 历史版本列表
app.get(
  '/api/history',
  requireAuth,
  wrap(async (req, res) => {
    const path = String(req.query.path ?? '');
    if (!path) {
      res.status(400).json({ error: 'missing path' });
      return;
    }
    const revisions = await docHistory(path);
    res.json({ path, revisions });
  })
);

// 读取历史某版本内容
app.get(
  '/api/revision',
  requireAuth,
  wrap(async (req, res) => {
    const path = String(req.query.path ?? '');
    const commit = String(req.query.commit ?? '');
    if (!path || !commit) {
      res.status(400).json({ error: 'path and commit required' });
      return;
    }
    const content = await readDocAtCommit(path, commit);
    if (content === null) {
      res.status(404).json({ error: 'not found at commit' });
      return;
    }
    res.json({ path, commit, content });
  })
);

// 搜索
app.get(
  '/api/search',
  requireAuth,
  wrap(async (req, res) => {
    const q = String(req.query.q ?? '');
    res.json({ query: q, hits: search(q) });
  })
);

// 上传图片附件：原始二进制 body，Content-Type 决定类型
app.post(
  '/api/upload',
  requireWriter,
  express.raw({ type: Object.keys(IMAGE_TYPES), limit: MAX_ASSET_BYTES }),
  wrap(async (req, res) => {
    const contentType = req.header('content-type')?.split(';')[0].trim() ?? '';
    const ext = IMAGE_TYPES[contentType];
    if (!ext) {
      res.status(415).json({ error: 'unsupported image type' });
      return;
    }
    const body = req.body as Buffer;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      res.status(400).json({ error: 'empty body' });
      return;
    }
    const result = await saveAsset(body, ext);
    res.status(201).json(result);
  })
);

// 读取附件
app.get(
  '/api/asset',
  requireAuth,
  wrap(async (req, res) => {
    const path = String(req.query.path ?? '');
    if (!path.startsWith('/assets/')) {
      res.status(400).json({ error: 'invalid asset path' });
      return;
    }
    try {
      const data = await readBinary(path);
      const ext = path.split('.').pop()?.toLowerCase() ?? '';
      const type =
        Object.entries(IMAGE_TYPES).find(([, e]) => e === ext)?.[0] ??
        'application/octet-stream';
      res.setHeader('Content-Type', type);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.send(data);
    } catch {
      res.status(404).json({ error: 'asset not found' });
    }
  })
);

// === 用户管理（仅 writer 可操作） ===

app.get(
  '/api/users',
  requireWriter,
  wrap(async (_req, res) => {
    res.json({ users: await listUsers() });
  })
);

app.post(
  '/api/users',
  requireWriter,
  wrap(async (req, res) => {
    const { username, password, role } = req.body ?? {};
    if (typeof username !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'username and password required' });
      return;
    }
    const r: 'reader' | 'writer' = role === 'reader' ? 'reader' : 'writer';
    const result = await createUser(username, password, r);
    if (!result.ok) {
      res.status(result.error === 'exists' ? 409 : 400).json(result);
      return;
    }
    res.status(201).json(result);
  })
);

app.put(
  '/api/users/password',
  requireWriter,
  wrap(async (req, res) => {
    const { username, password } = req.body ?? {};
    if (typeof username !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'username and password required' });
      return;
    }
    const result = await setPassword(username, password);
    if (!result.ok) {
      res.status(404).json(result);
      return;
    }
    res.json(result);
  })
);

app.put(
  '/api/users/role',
  requireWriter,
  wrap(async (req, res) => {
    const { username, role } = req.body ?? {};
    if (typeof username !== 'string' || (role !== 'reader' && role !== 'writer')) {
      res.status(400).json({ error: 'username and valid role required' });
      return;
    }
    const result = await setRole(username, role);
    if (!result.ok) {
      const code = result.error === 'last_writer' ? 409 : 404;
      res.status(code).json(result);
      return;
    }
    res.json(result);
  })
);

app.delete(
  '/api/users',
  requireWriter,
  wrap(async (req, res) => {
    const username = String(req.query.username ?? '');
    if (!username) {
      res.status(400).json({ error: 'username required' });
      return;
    }
    // 防止删除最后一个 writer 导致无人可管理
    const users = await listUsers();
    const writers = users.filter((u) => u.role === 'writer');
    if (writers.length === 1 && writers[0].username === username) {
      res.status(409).json({ error: 'cannot delete the last writer' });
      return;
    }
    res.json(await deleteUser(username));
  })
);

async function start(): Promise<void> {
  await ensureRepo();
  await ensureSeedAdmin();
  await rebuildIndex();
  app.listen(config.port, () => {
    console.log(`Tomo server listening on :${config.port}`);
    console.log(`Repo: ${config.repoPath}`);
    console.log(`Users: ${config.usersFile}`);
  });
}

start().catch((err) => {
  console.error('failed to start:', err);
  process.exit(1);
});
