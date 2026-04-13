import { createClient } from "@/lib/supabase/server";

export default async function AdminGenerationsPage() {
  const supabase = createClient();

  const { data: logs } = await supabase
    .from("generation_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div>
      <h1 className="font-display text-display-lg">Gerações</h1>
      <p className="mt-2 font-body text-sm text-text-secondary">
        {logs?.length ?? 0} gerações registradas (últimas 100)
      </p>

      {(!logs || logs.length === 0) ? (
        <div className="mt-8 rounded-xl border border-white/5 p-8 text-center">
          <p className="font-mono text-label-sm text-text-secondary">
            Nenhuma geração registrada ainda.
          </p>
          <p className="mt-1 font-mono text-[10px] text-text-secondary">
            Os logs aparecerão aqui após executar a migration 00002 e gerar vídeos.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          {logs.map((log) => (
            <details
              key={log.id}
              className="group rounded-xl border border-white/5 transition-colors hover:border-white/10"
            >
              <summary className="flex cursor-pointer items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <span className={`rounded px-2 py-0.5 font-mono text-[9px] uppercase ${
                    log.generation_type === "transition"
                      ? "bg-accent-gold/10 text-accent-gold"
                      : "bg-white/5 text-text-secondary"
                  }`}>
                    {log.generation_type ?? "scene"}
                  </span>
                  <span className="font-mono text-label-sm">
                    {log.preset_id ?? "—"}
                  </span>
                  {log.duration_seconds && (
                    <span className="font-mono text-[10px] text-text-secondary">
                      {log.duration_seconds}s
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {log.cost && (
                    <span className="font-mono text-[10px] text-accent-gold">
                      ${Number(log.cost).toFixed(3)}
                    </span>
                  )}
                  <span className="font-mono text-[10px] text-text-secondary">
                    {new Date(log.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
              </summary>

              <div className="border-t border-white/5 p-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 font-mono text-[9px] uppercase tracking-widest text-text-secondary">User ID</p>
                    <p className="font-mono text-[10px] text-text-secondary break-all">{log.user_id}</p>
                  </div>
                  <div>
                    <p className="mb-1 font-mono text-[9px] uppercase tracking-widest text-text-secondary">Vision Model</p>
                    <p className="font-mono text-[10px] text-text-secondary">{log.vision_model ?? "—"}</p>
                  </div>
                </div>

                {log.vision_data && (
                  <div>
                    <p className="mb-1 font-mono text-[9px] uppercase tracking-widest text-text-secondary">Vision Data (JSON)</p>
                    <pre className="max-h-40 overflow-y-auto rounded-lg bg-white/[0.02] p-3 font-mono text-[10px] leading-relaxed text-text-secondary">
                      {JSON.stringify(log.vision_data, null, 2)}
                    </pre>
                  </div>
                )}

                {log.final_positive_prompt && (
                  <div>
                    <p className="mb-1 font-mono text-[9px] uppercase tracking-widest text-text-secondary">Final Prompt</p>
                    <pre className="overflow-x-auto rounded-lg bg-white/[0.02] p-3 font-mono text-[10px] leading-relaxed text-text-secondary">
                      {log.final_positive_prompt}
                    </pre>
                  </div>
                )}

                {log.request_payload && (
                  <div>
                    <p className="mb-1 font-mono text-[9px] uppercase tracking-widest text-text-secondary">Request</p>
                    <pre className="max-h-32 overflow-y-auto rounded-lg bg-white/[0.02] p-3 font-mono text-[10px] leading-relaxed text-text-secondary">
                      {JSON.stringify(log.request_payload, null, 2)}
                    </pre>
                  </div>
                )}

                {log.response_payload && (
                  <div>
                    <p className="mb-1 font-mono text-[9px] uppercase tracking-widest text-text-secondary">Response</p>
                    <pre className="max-h-32 overflow-y-auto rounded-lg bg-white/[0.02] p-3 font-mono text-[10px] leading-relaxed text-text-secondary">
                      {JSON.stringify(log.response_payload, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
