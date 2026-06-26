import { useCallback, useEffect, useState } from 'react';
import DocTree from './components/DocTree';
import Editor from './components/Editor';
import SearchPanel from './components/SearchPanel';
import HistoryPanel from './components/HistoryPanel';
import LoginPage from './components/LoginPage';
import UsersPanel from './components/UsersPanel';
import { api, ApiError, type DocNode, type User } from './api';
import './App.css';

type SaveState = 'idle' | 'saving' | 'saved' | 'conflict' | 'error';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [tree, setTree] = useState<DocNode[]>([]);
  const [activePath, setActivePath] = useState<string>('');
  const [content, setContent] = useState('');
  const [baseOid, setBaseOid] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [mode, setMode] = useState<'read' | 'edit'>('read');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [usersOpen, setUsersOpen] = useState(false);

  // 加载文档树
  const loadTree = useCallback(async () => {
    try {
      const t = await api.tree();
      setTree(t);
      return t;
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : '加载失败');
      return [];
    }
  }, []);

  // 打开文档
  const openDoc = useCallback(async (path: string) => {
    try {
      const doc = await api.doc(path);
      setActivePath(doc.path);
      setContent(doc.content);
      setBaseOid(doc.oid);
      setDirty(false);
      setMode('read');
      setSaveState('idle');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : '打开失败');
    }
  }, []);

  // 检查登录态
  useEffect(() => {
    void (async () => {
      try {
        const u = await api.whoami();
        setUser(u);
      } catch {
        setUser(null);
      } finally {
        setAuthChecked(true);
      }
    })();
  }, []);

  // 登录后（或已登录）加载文档树并打开第一篇
  useEffect(() => {
    if (!user) return;
    void (async () => {
      const t = await loadTree();
      const first = findFirstFile(t);
      if (first) void openDoc(first.path);
    })();
  }, [user, loadTree, openDoc]);

  const handleLogout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // 忽略
    }
    setUser(null);
    setActivePath('');
    setContent('');
    setTree([]);
  }, []);

  const isWriter = user?.role === 'writer';

  const handleSelect = (node: DocNode) => {
    if (node.type === 'file') void openDoc(node.path);
  };

  // 新建文档
  const handleNew = useCallback(async () => {
    const input = window.prompt('新建文档路径（相对仓库根，需以 .md 结尾）', '/new-doc.md');
    if (!input) return;
    let path = input.trim();
    if (!path.startsWith('/')) path = '/' + path;
    if (!path.endsWith('.md')) path += '.md';
    try {
      const title = path.split('/').pop()!.replace(/\.md$/, '');
      const res = await api.create(path, `# ${title}\n\n`);
      if (!res.ok && res.error === 'exists') {
        window.alert('该路径已存在同名文档');
        return;
      }
      await loadTree();
      await openDoc(path);
      setMode('edit');
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '新建失败');
    }
  }, [loadTree, openDoc]);

  // 重命名 / 移动文档
  const handleRename = useCallback(
    async (node: DocNode) => {
      const input = window.prompt('新的路径（重命名或移动，需以 .md 结尾）', node.path);
      if (!input) return;
      let to = input.trim();
      if (!to.startsWith('/')) to = '/' + to;
      if (!to.endsWith('.md')) to += '.md';
      if (to === node.path) return;
      try {
        const res = await api.move(node.path, to);
        if (!res.ok) {
          window.alert(res.error === 'target_exists' ? '目标路径已存在' : '源文档不存在');
          return;
        }
        await loadTree();
        if (activePath === node.path) await openDoc(to);
      } catch (err) {
        window.alert(err instanceof Error ? err.message : '操作失败');
      }
    },
    [loadTree, openDoc, activePath]
  );

  // 删除文档
  const handleDelete = useCallback(
    async (node: DocNode) => {
      if (!window.confirm(`确认删除「${node.name}」？此操作会生成一次 Git 提交。`)) return;
      try {
        await api.remove(node.path);
        const t = await loadTree();
        if (activePath === node.path) {
          const first = findFirstFile(t);
          if (first) await openDoc(first.path);
          else {
            setActivePath('');
            setContent('');
          }
        }
      } catch (err) {
        window.alert(err instanceof Error ? err.message : '删除失败');
      }
    },
    [loadTree, openDoc, activePath]
  );

  const handleAction = (action: 'rename' | 'delete', node: DocNode) => {
    if (action === 'rename') void handleRename(node);
    else void handleDelete(node);
  };

  const handleChange = (value?: string) => {
    setContent(value || '');
    setDirty(true);
    setSaveState('idle');
  };

  const handleSave = useCallback(async () => {
    if (!activePath) return;
    setSaveState('saving');
    try {
      const result = await api.save(activePath, content, baseOid);
      if (!result.ok && result.conflict) {
        setSaveState('conflict');
        return;
      }
      setBaseOid(result.oid ?? null);
      setDirty(false);
      setSaveState('saved');
      setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 2000);
    } catch (err) {
      setSaveState('error');
      if (err instanceof ApiError && err.status === 401) {
        setLoadError('未授权，请检查访问密码');
      }
    }
  }, [activePath, content, baseOid]);

  // Cmd/Ctrl+S 保存
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (mode === 'edit') void handleSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, handleSave]);

  const segments = activePath.replace(/^\//, '').split('/').filter(Boolean);
  const currentFileName = segments.length
    ? segments[segments.length - 1].replace(/\.md$/, '')
    : '未选择';
  const breadcrumb = segments.slice(0, -1);

  // 鉴权门：检查中显示空白，未登录显示登录页
  if (!authChecked) {
    return <div className="tomo-auth-loading" />;
  }
  if (!user) {
    return <LoginPage onLoggedIn={() => void api.whoami().then(setUser)} />;
  }

  return (
    <div className="tomo-app">
      <aside className={`tomo-sidebar ${sidebarOpen ? '' : 'is-collapsed'}`}>
        <div className="tomo-sidebar-top">
          <div className="tomo-brand">
            <span className="tomo-brand-mark">T</span>
            <span className="tomo-brand-name">Tomo</span>
          </div>
        </div>

        <SearchPanel onOpenDoc={(p) => void openDoc(p)} />

        <div className="tomo-sidebar-scroll">
          <div className="tomo-collection-label">
            <span>团队文档</span>
            {isWriter && (
              <button
                className="tomo-new-btn"
                type="button"
                title="新建文档"
                onClick={() => void handleNew()}
              >
                +
              </button>
            )}
          </div>
          {tree.length === 0 ? (
            <div className="tomo-tree-empty">
              {loadError ? `加载失败：${loadError}` : '暂无文档'}
            </div>
          ) : (
            <DocTree
              nodes={tree}
              activePath={activePath}
              onSelect={handleSelect}
              onAction={handleAction}
              showActions={isWriter}
            />
          )}
        </div>

        <div className="tomo-sidebar-foot">
          <div className="tomo-user">
            <span className="tomo-user-avatar">
              {user.username.charAt(0).toUpperCase()}
            </span>
            <span className="tomo-user-meta">
              <span className="tomo-user-name">{user.username}</span>
              <span className="tomo-user-role">
                {user.role === 'writer' ? '可编辑' : '只读'}
              </span>
            </span>
            {isWriter && (
              <button
                className="tomo-logout-btn"
                type="button"
                title="用户管理"
                onClick={() => setUsersOpen(true)}
              >
                <UsersIcon />
              </button>
            )}
            <button
              className="tomo-logout-btn"
              type="button"
              title="登出"
              onClick={() => void handleLogout()}
            >
              <LogoutIcon />
            </button>
          </div>
        </div>
      </aside>

      <main className="tomo-main">
        <header className="tomo-topbar">
          <div className="tomo-topbar-left">
            <button
              className="tomo-icon-btn"
              type="button"
              title="侧边栏"
              onClick={() => setSidebarOpen((v) => !v)}
            >
              <MenuIcon />
            </button>
            <nav className="tomo-breadcrumb">
              {breadcrumb.map((seg, i) => (
                <span key={i} className="tomo-crumb">
                  {seg}
                  <span className="tomo-crumb-sep">/</span>
                </span>
              ))}
              <span className="tomo-crumb is-current">{currentFileName}</span>
            </nav>
          </div>
          <div className="tomo-topbar-right">
            <SaveStatus state={saveState} dirty={dirty} />
            {isWriter && (
              <div className="tomo-mode-switch">
                <button
                  className={`tomo-mode-btn ${mode === 'read' ? 'is-active' : ''}`}
                  type="button"
                  onClick={() => setMode('read')}
                >
                  阅读
                </button>
                <button
                  className={`tomo-mode-btn ${mode === 'edit' ? 'is-active' : ''}`}
                  type="button"
                  onClick={() => setMode('edit')}
                >
                  编辑
                </button>
              </div>
            )}
            {isWriter && mode === 'edit' && (
              <button
                className="tomo-save-btn"
                type="button"
                onClick={() => void handleSave()}
                disabled={!dirty || saveState === 'saving'}
              >
                保存
              </button>
            )}
            <button
              className="tomo-icon-btn"
              type="button"
              title="历史"
              onClick={() => setHistoryOpen(true)}
              disabled={!activePath}
            >
              <HistoryIcon />
            </button>
          </div>
        </header>

        {saveState === 'conflict' && (
          <div className="tomo-banner tomo-banner-warn">
            该文档已被其他人修改，你的保存被拒绝以防覆盖。请刷新文档后重新编辑。
            <button
              className="tomo-banner-action"
              type="button"
              onClick={() => void openDoc(activePath)}
            >
              重新加载
            </button>
          </div>
        )}

        <div className="tomo-doc-scroll">
          <div className="tomo-doc">
            <Editor value={content} onChange={handleChange} mode={mode} />
          </div>
        </div>
      </main>

      <HistoryPanel
        path={activePath}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onRestore={(restored) => {
          setContent(restored);
          setDirty(true);
          setMode('edit');
          setSaveState('idle');
          setHistoryOpen(false);
        }}
      />

      <UsersPanel
        open={usersOpen}
        onClose={() => setUsersOpen(false)}
        currentUsername={user.username}
      />
    </div>
  );
}

function SaveStatus({ state, dirty }: { state: SaveState; dirty: boolean }) {
  let text = '';
  if (state === 'saving') text = '保存中…';
  else if (state === 'saved') text = '已保存';
  else if (state === 'error') text = '保存失败';
  else if (dirty) text = '未保存';
  if (!text) return null;
  return <span className={`tomo-save-status is-${state}`}>{text}</span>;
}

function findFirstFile(nodes: DocNode[]): DocNode | null {
  for (const n of nodes) {
    if (n.type === 'file') return n;
    if (n.children) {
      const f = findFirstFile(n.children);
      if (f) return f;
    }
  }
  return null;
}

/* === 极简线性图标 === */
function MenuIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function HistoryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 4v4l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function LogoutIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M6 2H3v12h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="6" cy="5" r="2.4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M1.5 14c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M11 5.2a2.2 2.2 0 010 4M12 13.8c0-1.6-.6-2.9-1.6-3.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
