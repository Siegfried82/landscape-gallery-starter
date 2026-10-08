'use client';

import {useState} from 'react';

export default function AdminLoginForm({onSuccess}: {onSuccess: () => void}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({password}),
      });
      const data = await res.json() as {error?: string; ok?: boolean};
      if (!res.ok || data.error) {
        setError(data.error || '密码错误');
      } else {
        onSuccess();
      }
    } catch {
      setError('网络异常，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '70vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <form onSubmit={handleSubmit} style={{
        maxWidth: 380,
        width: '100%',
        padding: '36px 30px',
        borderRadius: 16,
        background: 'var(--card-bg, #fff)',
        border: '1px solid rgba(128,128,128,0.2)',
        boxShadow: '0 12px 36px rgba(0,0,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}>
        <div style={{textAlign: 'center', marginBottom: 8}}>
          <h2 style={{fontSize: 20, fontWeight: 600, margin: '0 0 6px 0'}}>画廊管理端</h2>
          <p style={{fontSize: 13, color: '#888', margin: 0}}>请输入管理密码解锁后台与上传</p>
        </div>

        {error && (
          <div style={{
            padding: '10px 14px',
            borderRadius: 8,
            backgroundColor: '#fee2e2',
            color: '#dc2626',
            fontSize: 13,
            textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        <div>
          <label htmlFor="admin-password" style={{display: 'block', fontSize: 13, marginBottom: 6, fontWeight: 500}}>
            管理密码
          </label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="输入管理密码"
            autoComplete="current-password"
            required
            disabled={loading}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid #ccc',
              fontSize: 14,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: 6,
            padding: '11px',
            borderRadius: 8,
            border: 'none',
            backgroundColor: '#111',
            color: '#fff',
            fontWeight: 500,
            fontSize: 14,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
            transition: 'background-color 0.2s',
          }}
        >
          {loading ? '正在验证…' : '解锁管理端'}
        </button>

        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Keep the existing direct navigation to the public gallery. */}
        <a
          href="/"
          style={{
            textAlign: 'center',
            fontSize: 12,
            color: '#888',
            textDecoration: 'none',
            marginTop: 4,
          }}
        >
          ← 返回公开画廊
        </a>
      </form>
    </div>
  );
}

