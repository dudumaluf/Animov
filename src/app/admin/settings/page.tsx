import { createClient } from "@/lib/supabase/server";
import { ModelToggle } from "./model-toggle";

export default async function AdminSettingsPage() {
  const supabase = createClient();

  const { data: settings } = await supabase
    .from("system_settings")
    .select("key, value, updated_at")
    .order("key");

  const { data: models } = await supabase
    .from("models")
    .select("id, model_key, display_name, cost_per_second, active, supports_start_end_frame")
    .order("display_name");

  return (
    <div>
      <h1 className="font-display text-display-lg">Configurações</h1>

      <div className="mt-8">
        <h2 className="font-display text-xl">System Settings</h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-white/5">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-text-secondary">Key</th>
                <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-text-secondary">Value</th>
                <th className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-widest text-text-secondary">Updated</th>
              </tr>
            </thead>
            <tbody>
              {settings?.map((s) => (
                <tr key={s.key} className="border-b border-white/5">
                  <td className="px-4 py-3 font-mono text-label-sm text-accent-gold">{s.key}</td>
                  <td className="px-4 py-3 font-mono text-label-sm text-text-secondary">
                    {JSON.stringify(s.value)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[10px] text-text-secondary">
                    {new Date(s.updated_at).toLocaleDateString("pt-BR")}
                  </td>
                </tr>
              ))}
              {(!settings || settings.length === 0) && (
                <tr><td colSpan={3} className="px-4 py-6 text-center font-mono text-label-sm text-text-secondary">Nenhuma configuração</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="font-display text-xl">Modelos de Vídeo</h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-white/5">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-text-secondary">Model</th>
                <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-text-secondary">Key</th>
                <th className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-widest text-text-secondary">Cost/s</th>
                <th className="px-4 py-3 text-center font-mono text-[10px] uppercase tracking-widest text-text-secondary">Start+End</th>
                <th className="px-4 py-3 text-center font-mono text-[10px] uppercase tracking-widest text-text-secondary">Status</th>
              </tr>
            </thead>
            <tbody>
              {models?.map((m) => (
                <tr key={m.id} className="border-b border-white/5">
                  <td className="px-4 py-3 font-mono text-label-sm">{m.display_name}</td>
                  <td className="px-4 py-3 font-mono text-[10px] text-text-secondary">{m.model_key}</td>
                  <td className="px-4 py-3 text-right font-mono text-label-sm text-accent-gold">${Number(m.cost_per_second).toFixed(3)}</td>
                  <td className="px-4 py-3 text-center font-mono text-[10px]">
                    {m.supports_start_end_frame ? <span className="text-green-400">✓</span> : <span className="text-text-secondary">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ModelToggle modelId={m.id} initialActive={m.active} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
