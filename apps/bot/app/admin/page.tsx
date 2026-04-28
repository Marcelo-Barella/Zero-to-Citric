'use client';
import { useState, type FormEvent } from 'react';

interface ForgetResponse {
  ok: boolean;
  deleted?: { memories: number; recent: number };
  error?: string;
}

export default function AdminPage() {
  const [token, setToken] = useState('');
  const [scope, setScope] = useState<'user' | 'guild'>('user');
  const [guildId, setGuildId] = useState('');
  const [userId, setUserId] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string>('');

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setResult('');
    try {
      const body: { scope: 'user' | 'guild'; guildId: string; userId?: string } = { scope, guildId };
      if (scope === 'user') body.userId = userId;
      const res = await fetch('/api/memory/forget', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as ForgetResponse;
      setResult(`status=${res.status} ${JSON.stringify(json)}`);
    } catch (err) {
      setResult(`error: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>Tangerina admin</h1>
      <p>
        Health: <a href="/api/health">/api/health</a>
      </p>
      <h2>Forget memory</h2>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 500 }}>
        <label>
          Admin token
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
            style={{ width: '100%' }}
          />
        </label>
        <label>
          Scope
          <select value={scope} onChange={(e) => setScope(e.target.value as 'user' | 'guild')}>
            <option value="user">user</option>
            <option value="guild">guild</option>
          </select>
        </label>
        <label>
          Guild id
          <input value={guildId} onChange={(e) => setGuildId(e.target.value)} required style={{ width: '100%' }} />
        </label>
        {scope === 'user' ? (
          <label>
            User id
            <input value={userId} onChange={(e) => setUserId(e.target.value)} required style={{ width: '100%' }} />
          </label>
        ) : null}
        <button type="submit" disabled={busy}>
          {busy ? 'Working…' : 'Forget'}
        </button>
      </form>
      <pre data-testid="result" style={{ marginTop: 16 }}>
        {result}
      </pre>
    </main>
  );
}
