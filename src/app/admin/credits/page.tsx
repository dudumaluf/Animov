"use client";

import { useState } from "react";

export default function AdminCreditsPage() {
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState(10);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [history, setHistory] = useState<Array<{
    id: string;
    delta: number;
    reason: string;
    created_at: string;
  }>>([]);

  const [userData, setUserData] = useState<{
    id: string;
    email: string;
    balance: number;
  } | null>(null);

  const searchUser = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/search?email=${encodeURIComponent(email)}`);
      if (!res.ok) { setResult("Usuário não encontrado"); setUserData(null); return; }
      const data = await res.json();
      setUserData(data);
      setResult(null);

      const histRes = await fetch(`/api/admin/users/${data.id}/transactions`);
      if (histRes.ok) {
        const hist = await histRes.json();
        setHistory(hist);
      }
    } catch {
      setResult("Erro ao buscar");
    } finally {
      setLoading(false);
    }
  };

  const addCredits = async () => {
    if (!userData || !reason.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userData.id, amount, reason }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(`Créditos atualizados. Novo saldo: ${data.balance}`);
        setUserData({ ...userData, balance: data.balance });
        searchUser();
      } else {
        setResult(`Erro: ${data.error}`);
      }
    } catch {
      setResult("Erro ao adicionar créditos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="font-display text-display-lg">Créditos</h1>
      <p className="mt-2 font-body text-sm text-text-secondary">
        Gerenciar créditos de usuários
      </p>

      <div className="mt-8 max-w-lg space-y-4">
        <div>
          <label className="mb-1 block font-mono text-label-xs uppercase tracking-widest text-text-secondary">
            Buscar por email
          </label>
          <div className="flex gap-2">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchUser()}
              placeholder="email@exemplo.com"
              className="flex-1 rounded-lg border border-white/10 bg-transparent px-3 py-2 font-mono text-label-sm text-[var(--text)] placeholder:text-text-secondary focus:border-accent-gold/30 focus:outline-none"
            />
            <button
              onClick={searchUser}
              disabled={loading}
              className="rounded-lg bg-white/5 px-4 py-2 font-mono text-label-sm text-text-secondary transition-colors hover:bg-white/10 hover:text-[var(--text)]"
            >
              Buscar
            </button>
          </div>
        </div>

        {userData && (
          <div className="rounded-xl border border-white/5 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-label-sm">{userData.email}</p>
                <p className="font-mono text-[10px] text-text-secondary">{userData.id}</p>
              </div>
              <p className="font-display text-2xl text-accent-gold">{userData.balance} cr.</p>
            </div>

            <div className="border-t border-white/5 pt-4 space-y-3">
              <div className="flex gap-2">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-24 rounded-lg border border-white/10 bg-transparent px-3 py-2 font-mono text-label-sm text-[var(--text)] focus:border-accent-gold/30 focus:outline-none"
                />
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Motivo"
                  className="flex-1 rounded-lg border border-white/10 bg-transparent px-3 py-2 font-mono text-label-sm text-[var(--text)] placeholder:text-text-secondary focus:border-accent-gold/30 focus:outline-none"
                />
              </div>
              <button
                onClick={addCredits}
                disabled={loading || !reason.trim()}
                className="w-full rounded-lg bg-accent-gold py-2 font-mono text-label-sm uppercase tracking-widest text-[#0D0D0B] transition-opacity hover:opacity-80 disabled:opacity-30"
              >
                Adicionar {amount} créditos
              </button>
            </div>

            {history.length > 0 && (
              <div className="border-t border-white/5 pt-4">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-text-secondary">Histórico</p>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {history.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between py-1">
                      <div>
                        <span className="font-mono text-[11px] text-text-secondary">{tx.reason}</span>
                        <span className="ml-2 font-mono text-[9px] text-text-secondary">
                          {new Date(tx.created_at).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      <span className={`font-mono text-label-sm ${tx.delta > 0 ? "text-green-400" : "text-red-400"}`}>
                        {tx.delta > 0 ? "+" : ""}{tx.delta}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {result && (
          <p className="font-mono text-label-sm text-accent-gold">{result}</p>
        )}
      </div>
    </div>
  );
}
