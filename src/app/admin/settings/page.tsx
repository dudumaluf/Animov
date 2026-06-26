import { createClient } from "@/lib/supabase/server";
import { ModelToggle } from "./model-toggle";
import { SettingRow, CatalogRow } from "./settings-editors";
import { FalKeyEditor } from "./fal-key-editor";

export default async function AdminSettingsPage() {
  const supabase = createClient();

  const { data: settings } = await supabase
    .from("system_settings")
    .select("key, value, updated_at")
    .order("key");

  const { data: catalog } = await supabase
    .from("billing_catalog")
    .select("stripe_price_id, kind, plan, credits, label, display_price, active, sort_order")
    .order("sort_order");

  const { data: models } = await supabase
    .from("models")
    .select("id, model_key, display_name, cost_per_second, active, supports_start_end_frame")
    .order("display_name");

  return (
    <div>
      <h1 className="font-display text-display-lg">Configurações</h1>

      <div className="mt-8">
        <h2 className="font-display text-xl">System Settings</h2>
        <p className="mt-1 font-body text-sm text-text-secondary">
          Inteiros como <code className="text-accent-gold">free_credits</code> e{" "}
          <code className="text-accent-gold">fal_max_concurrent</code> são
          editáveis ao vivo (≥ 0, sem deploy).
        </p>
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
                  <td className="px-4 py-3 align-middle font-mono text-label-sm text-accent-gold">{s.key}</td>
                  <td className="px-4 py-3">
                    <SettingRow
                      settingKey={s.key}
                      initialValue={
                        typeof s.value === "number" || typeof s.value === "string"
                          ? s.value
                          : JSON.stringify(s.value)
                      }
                      type={typeof s.value === "number" ? "integer" : "string"}
                    />
                  </td>
                  <td className="px-4 py-3 text-right align-middle font-mono text-[10px] text-text-secondary">
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

      <FalKeyEditor />

      <div className="mt-8">
        <h2 className="font-display text-xl">Catálogo de Preços</h2>
        <p className="mt-1 font-body text-sm text-text-secondary">
          Créditos concedidos e rótulos são editáveis sem deploy. O valor cobrado
          (preço) é imutável no Stripe — para alterá-lo, crie um novo preço.
        </p>
        <div className="mt-4 overflow-hidden rounded-xl border border-white/5">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-text-secondary">Plano / Preço</th>
                <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-text-secondary">Créditos</th>
                <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-text-secondary">Label</th>
                <th className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-widest text-text-secondary"></th>
              </tr>
            </thead>
            <tbody>
              {catalog?.map((c) => (
                <CatalogRow
                  key={c.stripe_price_id}
                  stripePriceId={c.stripe_price_id}
                  kind={c.kind}
                  plan={c.plan}
                  displayPrice={c.display_price}
                  initialCredits={c.credits}
                  initialLabel={c.label}
                />
              ))}
              {(!catalog || catalog.length === 0) && (
                <tr><td colSpan={4} className="px-4 py-6 text-center font-mono text-label-sm text-text-secondary">Catálogo vazio — rode o script de setup do Stripe</td></tr>
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
