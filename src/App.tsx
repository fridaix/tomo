import { useCallback, useEffect, useState } from 'react';
import DocTree from './components/DocTree';
import Editor from './components/Editor';
import { api, ApiError, type DocNode } from './api';
import './App.css';

type SaveState = 'idle' | 'saving' | 'saved' | 'conflict' | 'error';

export default function App() {
  const [tree, setTree] = useState<DocNode[]>([]);
  const [activePath, setActivePath] = useState<string>('');
  const [content, setContent] = useState('');
  const [baseOid, setBaseOid] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [mode, setMode] = useState<'read' | 'edit'>('read');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);

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

  // 首次加载：拉树并打开第一篇文档
  useEffect(() => {
    void (async () => {
      const t = await loadTree();
      const first = findFirstFile(t);
      if (first) void openDoc(first.path);
    })();
  }, [loadTree, openDoc]);

  const handleSelect = (node: DocNode) => {
    if (node.type === 'file') void openDoc(node.path);
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

  return (
    <div className="tomo-app">
      <aside className={`tomo-sidebar ${sidebarOpen ? '' : 'is-collapsed'}`}>
        <div className="tomo-sidebar-top">
          <div className="tomo-brand">
            <span className="tomo-brand-mark">T</span>
            <span className="tomo-brand-name">Tomo</span>
          </div>
          <button className="tomo-icon-btn" type="button" title="搜索">
            <SearchIcon />
          </button>
        </div>

        <div className="tomo-search">
          <SearchIcon />
          <input className="tomo-search-input" placeholder="搜索文档…" readOnly />
        </div>

        <div className="tomo-sidebar-scroll">
          <div className="tomo-collection-label">团队文档</div>
          {tree.length === 0 ? (
            <div className="tomo-tree-empty">
              {loadError ? `加载失败：${loadError}` : '暂无文档'}
            </div>
          ) : (
            <DocTree nodes={tree} activePath={activePath} onSelect={handleSelect} />
          )}
        </div>

        <div className="tomo-sidebar-foot">
          <div className="tomo-user">
            <span className="tomo-user-avatar">A</span>
            <span className="tomo-user-name">Alice</span>
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
            {mode === 'edit' && (
              <button
                className="tomo-save-btn"
                type="button"
                onClick={() => void handleSave()}
                disabled={!dirty || saveState === 'saving'}
              >
                保存
              </button>
            )}
            <button className="tomo-icon-btn" type="button" title="历史">
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
function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
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
