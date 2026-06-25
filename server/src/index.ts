import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { auth } from './auth.js';
import { buildDocTree, readDoc } from './repo.js';
import {
  ensureRepo,
  fileOid,
  saveDoc,
  deleteDoc,
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
app.use(cors());
app.use(express.json({ limit: '5mb' }));

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

// 以下接口需要鉴权
app.use('/api', auth);

// 文档树
app.get(
  '/api/tree',
  wrap(async (_req, res) => {
    const tree = await buildDocTree();
    res.json({ tree });
  })
);

// 读单篇文档（含当前 blob sha，供前端保存时做冲突检测）
app.get(
  '/api/doc',
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

// 历史版本列表
app.get(
  '/api/history',
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
  wrap(async (req, res) => {
    const q = String(req.query.q ?? '');
    res.json({ query: q, hits: search(q) });
  })
);

async function start(): Promise<void> {
  await ensureRepo();
  await rebuildIndex();
  app.listen(config.port, () => {
    console.log(`Tomo server listening on :${config.port}`);
    console.log(`Repo: ${config.repoPath}`);
    console.log(`Auth: ${config.password ? 'password' : 'disabled (dev)'}`);
  });
}

start().catch((err) => {
  console.error('failed to start:', err);
  process.exit(1);
});
