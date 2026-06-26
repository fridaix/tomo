import { useEffect, useState } from 'react';
import { api, ApiError, type User, type Role } from '../api';
import './UsersPanel.css';

interface UsersPanelProps {
  open: boolean;
  onClose: () => void;
  currentUsername: string;
}

export default function UsersPanel({ open, onClose, currentUsername }: UsersPanelProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 新增用户表单
  const [newName, setNewName] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newRole, setNewRole] = useState<Role>('reader');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await api.listUsers());
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) void load();
  }, [open]);

  const wrap = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      if (!res.ok) {
        setError(translate(res.error));
        return false;
      }
      await load();
      return true;
    } catch (err) {
      if (err instanceof ApiError) setError(translate(err.message));
      else setError(err instanceof Error ? err.message : '操作失败');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const addUser = async () => {
    if (!newName.trim() || !newPw) {
      setError('用户名和密码不能为空');
      return;
    }
    const ok = await wrap(() => api.createUser(newName.trim(), newPw, newRole));
    if (ok) {
      setNewName('');
      setNewPw('');
      setNewRole('reader');
    }
  };

  const changeRole = (u: User, role: Role) => {
    if (role === u.role) return;
    void wrap(() => api.setUserRole(u.username, role));
  };

  const resetPassword = (u: User) => {
    const pw = window.prompt(`为「${u.username}」设置新密码`);
    if (!pw) return;
    void wrap(() => api.setUserPassword(u.username, pw));
  };

  const removeUser = (u: User) => {
    if (!window.confirm(`确认删除用户「${u.username}」？`)) return;
    void wrap(() => api.deleteUser(u.username));
  };

  if (!open) return null;

  return (
    <>
      <div className="tomo-users-backdrop" onClick={onClose} />
      <aside className="tomo-users">
        <header className="tomo-users-head">
          <h3 className="tomo-users-title">用户管理</h3>
          <button className="tomo-icon-btn" type="button" onClick={onClose} title="关闭">
            <CloseIcon />
          </button>
        </header>

        {error && <div className="tomo-users-error">{error}</div>}

        <div className="tomo-users-body">
          {/* 新增用户 */}
          <div className="tomo-users-add">
            <div className="tomo-users-add-row">
              <input
                className="tomo-users-input"
                placeholder="用户名"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <input
                className="tomo-users-input"
                type="password"
                placeholder="密码"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
              />
              <select
                className="tomo-users-select"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as Role)}
              >
                <option value="reader">只读</option>
                <option value="writer">可编辑</option>
              </select>
              <button
                className="tomo-users-add-btn"
                type="button"
                onClick={() => void addUser()}
                disabled={busy}
              >
                添加
              </button>
            </div>
          </div>

          {/* 用户列表 */}
          <div className="tomo-users-list">
            {loading ? (
              <div className="tomo-users-empty">加载中…</div>
            ) : users.length === 0 ? (
              <div className="tomo-users-empty">暂无用户</div>
            ) : (
              users.map((u) => (
                <div key={u.username} className="tomo-users-item">
                  <div className="tomo-users-item-main">
                    <span className="tomo-users-avatar">
                      {u.username.charAt(0).toUpperCase()}
                    </span>
                    <span className="tomo-users-name">
                      {u.username}
                      {u.username === currentUsername && (
                        <span className="tomo-users-you">你</span>
                      )}
                    </span>
                  </div>
                  <div className="tomo-users-item-actions">
                    <select
                      className="tomo-users-select"
                      value={u.role}
                      onChange={(e) => changeRole(u, e.target.value as Role)}
                      disabled={busy}
                    >
                      <option value="reader">只读</option>
                      <option value="writer">可编辑</option>
                    </select>
                    <button
                      className="tomo-users-mini"
                      type="button"
                      onClick={() => resetPassword(u)}
                      disabled={busy}
                    >
                      改密码
                    </button>
                    <button
                      className="tomo-users-mini is-danger"
                      type="button"
                      onClick={() => removeUser(u)}
                      disabled={busy || u.username === currentUsername}
                      title={u.username === currentUsername ? '不能删除自己' : '删除'}
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

function translate(err?: string): string {
  switch (err) {
    case 'exists':
      return '用户名已存在';
    case 'last_writer':
    case 'cannot delete the last writer':
      return '不能移除最后一个可编辑用户';
    case 'not_found':
      return '用户不存在';
    default:
      return err ?? '操作失败';
  }
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
