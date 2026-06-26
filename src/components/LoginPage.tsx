import { useState } from 'react';
import { api, ApiError } from '../api';
import './LoginPage.css';

interface LoginPageProps {
  onLoggedIn: () => void;
}

export default function LoginPage({ onLoggedIn }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    setBusy(true);
    setError(null);
    try {
      await api.login(username, password);
      onLoggedIn();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('用户名或密码错误');
      } else {
        setError(err instanceof Error ? err.message : '登录失败');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tomo-login">
      <form className="tomo-login-card" onSubmit={submit}>
        <div className="tomo-login-brand">
          <span className="tomo-login-mark">T</span>
          <span className="tomo-login-name">Tomo</span>
        </div>
        <p className="tomo-login-sub">登录以访问团队文档</p>

        <label className="tomo-login-field">
          <span>用户名</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            autoComplete="username"
          />
        </label>

        <label className="tomo-login-field">
          <span>密码</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>

        {error && <div className="tomo-login-error">{error}</div>}

        <button className="tomo-login-btn" type="submit" disabled={busy}>
          {busy ? '登录中…' : '登录'}
        </button>
      </form>
    </div>
  );
}
