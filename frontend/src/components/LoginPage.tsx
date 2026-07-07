import { useState } from "react";
import { api } from "../api";

// Demo login gate. Validates against the backend (/auth/login → env credentials);
// on success the parent stores a flag and renders the app. Credentials are never shown.
export default function LoginPage({ onSuccess }: { onSuccess: (user: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.login(username.trim(), password);
      onSuccess(res.user);
    } catch {
      setError("Invalid username or password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-[#f7f8fa] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <img src="/image.png" alt="Voiant" className="h-11 w-auto" />
          <div>
            <div className="font-display text-xl font-extrabold tracking-tight text-navy">Voiant</div>
            <div className="text-[12px] font-medium text-slatebody">Sales Planning Intelligence</div>
          </div>
        </div>

        <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <h1 className="font-display text-lg font-bold text-navy">Sign in</h1>
          <p className="mt-0.5 text-[13px] text-slatebody">Enter your credentials to continue.</p>

          <label className="mt-5 block text-[12px] font-semibold text-navy">
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink outline-none focus:border-brand"
            />
          </label>

          <label className="mt-4 block text-[12px] font-semibold text-navy">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink outline-none focus:border-brand"
            />
          </label>

          {error && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !username || !password}
            className="btn-dark mt-5 w-full justify-center py-2.5 disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-[11px] text-slate-400">
          Voiant Sales Planning Intelligence · Powered by Brightcone
        </p>
      </div>
    </div>
  );
}
