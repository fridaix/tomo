import { useEffect, useState } from 'react';
import MarkdownView from './MarkdownView';
import { api, type Revision } from '../api';
import './HistoryPanel.css';

interface HistoryPanelProps {
  path: string;
  open: boolean;
  onClose: () => void;
  onRestore: (content: string) => void;
}

function formatTime(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function HistoryPanel({ path, open, onClose, onRestore }: HistoryPanelProps) {
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);

  // 打开时加载历史
  useEffect(() => {
    if (!open || !path) return;
    setLoading(true);
    setSelected(null);
    setPreview('');
    void (async () => {
      try {
        const revs = await api.history(path);
        setRevisions(revs);
      } catch {
        setRevisions([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, path]);

  const selectRevision = async (commit: string) => {
    setSelected(commit);
    setPreviewLoading(true);
    try {
      const content = await api.revision(path, commit);
      setPreview(content);
    } catch {
      setPreview('（无法加载该版本）');
    } finally {
      setPreviewLoading(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="tomo-history-backdrop" onClick={onClose} />
      <aside className="tomo-history">
        <header className="tomo-history-head">
          <h3 className="tomo-history-title">历史版本</h3>
          <button className="tomo-icon-btn" type="button" onClick={onClose} title="关闭">
            <CloseIcon />
          </button>
        </header>

        <div className="tomo-history-body">
          <div className="tomo-history-list">
            {loading ? (
              <div className="tomo-history-empty">加载中…</div>
            ) : revisions.length === 0 ? (
              <div className="tomo-history-empty">暂无历史版本</div>
            ) : (
              revisions.map((rev, i) => (
                <button
                  key={rev.commit}
                  className={`tomo-history-item ${selected === rev.commit ? 'is-active' : ''}`}
                  type="button"
                  onClick={() => void selectRevision(rev.commit)}
                >
                  <div className="tomo-history-item-top">
                    <span className="tomo-history-badge">
                      {i === 0 ? '最新' : `#${revisions.length - i}`}
                    </span>
                    <span className="tomo-history-time">{formatTime(rev.timestamp)}</span>
                  </div>
                  <div className="tomo-history-msg">{rev.message}</div>
                  <div className="tomo-history-author">{rev.author}</div>
                </button>
              ))
            )}
          </div>

          <div className="tomo-history-preview">
            {selected ? (
              previewLoading ? (
                <div className="tomo-history-empty">加载版本内容…</div>
              ) : (
                <>
                  <div className="tomo-history-preview-bar">
                    <span className="tomo-history-preview-label">此版本预览</span>
                    <button
                      className="tomo-restore-btn"
                      type="button"
                      onClick={() => onRestore(preview)}
                    >
                      恢复到此版本
                    </button>
                  </div>
                  <div className="tomo-history-preview-content">
                    <MarkdownView source={preview} />
                  </div>
                </>
              )
            ) : (
              <div className="tomo-history-empty">选择左侧版本查看内容</div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
