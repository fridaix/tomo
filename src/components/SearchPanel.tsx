import { useEffect, useRef, useState } from 'react';
import { api, type SearchHit } from '../api';
import './SearchPanel.css';

interface SearchPanelProps {
  onOpenDoc: (path: string) => void;
}

export default function SearchPanel({ onOpenDoc }: SearchPanelProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 防抖搜索
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const result = await api.search(q);
        setHits(result);
        setActiveIdx(0);
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  // 打开时聚焦
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // 全局快捷键：Cmd/Ctrl+K 打开，Esc 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const choose = (hit: SearchHit) => {
    onOpenDoc(hit.path);
    setOpen(false);
    setQuery('');
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, hits.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && hits[activeIdx]) {
      choose(hits[activeIdx]);
    }
  };

  return (
    <div className="tomo-search-host" ref={containerRef}>
      <button
        className="tomo-search-trigger"
        type="button"
        onClick={() => setOpen(true)}
      >
        <SearchIcon />
        <span>搜索文档</span>
        <kbd className="tomo-kbd">⌘K</kbd>
      </button>

      {open && (
        <div className="tomo-search-pop">
          <div className="tomo-search-field">
            <SearchIcon />
            <input
              ref={inputRef}
              className="tomo-search-pop-input"
              placeholder="搜索文档标题和内容…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKey}
            />
            {loading && <span className="tomo-search-spinner" />}
          </div>

          {query.trim() && (
            <div className="tomo-search-results">
              {hits.length === 0 && !loading ? (
                <div className="tomo-search-empty">没有找到匹配的文档</div>
              ) : (
                hits.map((hit, i) => (
                  <button
                    key={hit.path}
                    className={`tomo-search-hit ${i === activeIdx ? 'is-active' : ''}`}
                    type="button"
                    onMouseEnter={() => setActiveIdx(i)}
                    onClick={() => choose(hit)}
                  >
                    <div className="tomo-search-hit-title">{hit.title}</div>
                    <div className="tomo-search-hit-path">{hit.path}</div>
                    <div className="tomo-search-hit-snippet">{hit.snippet}</div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
