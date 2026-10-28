"use client";

import { Copy, Trash2, X } from "lucide-react";
import { useState } from "react";
import { LLMS, type LlmId } from "@/lib/analysis";
import { corsHelp, LOCAL_LABELS, type LocalService, siteOrigin } from "@/lib/local";
import { PROVIDERS } from "@/lib/providers";
import { clearKeys, type Settings } from "@/lib/settings";
import { HardwareCard } from "./HardwareCard";
import { type SettingsTab, useStudio } from "./state";
import { StatusDot } from "./ui";

const KEYS: [keyof Settings, string, string][] = [
  ["geminiKey", "Gemini", "aistudio.google.com/apikey · tiene nivel gratuito"],
  ["anthropicKey", "Claude (Anthropic)", "console.anthropic.com"],
  ["openaiKey", "OpenAI", "platform.openai.com/api-keys"],
  ["falKey", "fal.ai", "fal.ai/dashboard/keys"],
  ["replicateToken", "Replicate", "replicate.com/account/api-tokens"],
];

const SERVICES: [LocalService, string, keyof Settings, keyof Settings | null][] = [
  ["ollama", "Análisis", "ollamaUrl", "ollamaModel"],
  ["comfyui", "Imágenes", "comfyUrl", null],
  ["compat", "Análisis", "compatUrl", "compatModel"],
];

function Field({ value, onChange, placeholder, secret }: { value: string; onChange: (v: string) => void; placeholder?: string; secret?: boolean }) {
  return (
    <input
      value={value}
      type={secret ? "password" : "text"}
      autoComplete="off"
      spellCheck={false}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full min-w-0 rounded-[7px] border border-border bg-surface px-2.5 text-[13px] outline-none focus:border-text"
    />
  );
}

export function SettingsDrawer({ tab: initialTab, onClose }: { tab: SettingsTab; onClose: () => void }) {
  const { settings, saveSettings, local, checkLocal, hardware, rec, recheckHardware } = useStudio();
  const [tab, setTab] = useState(initialTab);
  const [draft, setDraft] = useState(settings);
  const [copied, setCopied] = useState<string | null>(null);
  const set = (k: keyof Settings, v: string | number) => setDraft((d) => ({ ...d, [k]: v }));
  const origin = siteOrigin();

  const test = async (sv: LocalService) => {
    saveSettings(draft);
    await checkLocal(sv);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-black/70" />
      <div className="relative flex h-full w-full max-w-[520px] flex-col border-l border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <h2 className="text-lg font-semibold">Ajustes</h2>
          <button onClick={onClose} aria-label="Cerrar"><X className="size-5 text-muted" /></button>
        </div>
        <div className="flex gap-6 border-b border-border px-6">
          {([["local", "Modelos locales"], ["keys", "API keys"], ["hardware", "Tu equipo"], ["prefs", "Preferencias"]] as [SettingsTab, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)} className={`border-b-2 py-3.5 text-sm ${tab === t ? "border-accent font-semibold" : "border-transparent text-muted"}`}>{label}</button>
          ))}
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
          {tab === "local" && (
            <>
              <p className="text-[13px] leading-normal text-muted">Tu navegador se conecta directo a estos servicios en tu PC. Tienen que estar abiertos y permitir este sitio.</p>
              {SERVICES.map(([sv, role, urlKey, modelKey]) => {
                const st = local[sv], help = corsHelp(sv, origin);
                return (
                  <div key={sv} className={`flex flex-col gap-3 rounded-xl border bg-bg p-4 ${st === "off" ? "border-warning/35" : "border-border"}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-[15px] font-semibold">{LOCAL_LABELS[sv]}</span>
                        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">{role}</span>
                      </div>
                      <span className={`flex items-center gap-1.5 text-xs ${st === "ok" ? "text-success" : st === "off" ? "text-warning" : "text-muted"}`}>
                        <StatusDot state={st === "ok" ? "ok" : st === "off" ? "warn" : "off"} />
                        {st === "ok" ? "Conectado" : st === "off" ? "No responde" : "Sin probar"}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Field value={String(draft[urlKey])} onChange={(v) => set(urlKey, v)} />
                      {modelKey && <div className="w-[150px] shrink-0"><Field value={String(draft[modelKey])} onChange={(v) => set(modelKey, v)} placeholder="modelo" /></div>}
                      <button onClick={() => test(sv)} className="h-9 shrink-0 rounded-[7px] bg-surface-2 px-3 text-[13px] font-medium">Probar</button>
                    </div>
                    {st === "off" && (
                      <div className="flex flex-col gap-2.5 rounded-lg bg-warning/[0.07] p-3.5">
                        <p className="text-[13px] font-semibold">Ábrelo permitiendo este sitio:</p>
                        <button
                          onClick={() => { void navigator.clipboard?.writeText(help.command); setCopied(sv); }}
                          className="flex items-center justify-between gap-3 rounded-md bg-black px-3 py-2.5 text-left font-mono text-xs text-highlight"
                        >
                          <span className="break-all">{help.command}</span>
                          <span className="flex shrink-0 items-center gap-1 text-muted">{copied === sv ? "Copiado" : <Copy className="size-3.5" />}</span>
                        </button>
                        <p className="text-xs leading-normal text-muted">{help.note}</p>
                      </div>
                    )}
                  </div>
                );
              })}
              <p className="text-xs leading-normal text-subtle">Safari bloquea las conexiones a tu propio equipo desde un sitio seguro: para modelos locales usa Chrome o Edge.</p>
            </>
          )}

          {tab === "keys" && (
            <>
              <p className="text-[13px] leading-normal text-muted">Las keys se guardan solo en este navegador y se envían directo a cada proveedor. Replicate pasa por nuestro servidor solo para reenviar la petición: no se guarda.</p>
              {KEYS.map(([k, label, hint]) => (
                <label key={k} className="flex flex-col gap-1.5">
                  <span className="flex justify-between text-[13px] font-semibold">{label} <span className="font-normal text-subtle">{hint}</span></span>
                  <Field secret value={String(draft[k])} onChange={(v) => set(k, v.trim())} placeholder="sin configurar" />
                </label>
              ))}
            </>
          )}

          {tab === "hardware" && <HardwareCard hardware={hardware} rec={rec} onRecheck={recheckHardware} />}

          {tab === "prefs" && (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold">Modelo de análisis por defecto</span>
                <select value={draft.analysisLlm} onChange={(e) => set("analysisLlm", e.target.value)} className="h-9 rounded-[7px] border border-border bg-bg px-2.5 text-[13px]">
                  {(Object.keys(LLMS) as LlmId[]).map((id) => <option key={id} value={id}>{LLMS[id].label}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold">Generador de imágenes por defecto</span>
                <select value={draft.imageProvider} onChange={(e) => set("imageProvider", e.target.value)} className="h-9 rounded-[7px] border border-border bg-bg px-2.5 text-[13px]">
                  {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="flex justify-between text-[13px] font-semibold">Fuerza del estilo <span className="font-normal text-muted">{draft.styleStrength.toFixed(2)}</span></span>
                <input type="range" min={0.05} max={1} step={0.05} value={draft.styleStrength} onChange={(e) => set("styleStrength", Number(e.target.value))} className="accent-accent" />
              </label>
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <button onClick={() => { const next = clearKeys(draft); setDraft(next); saveSettings(next); }} className="flex items-center gap-1.5 text-[13px] text-accent">
            <Trash2 className="size-3.5" /> Borrar mis keys de este navegador
          </button>
          <button onClick={() => { saveSettings(draft); void checkLocal(); onClose(); }} className="h-10 rounded-lg bg-text px-[18px] text-sm font-semibold text-bg">Guardar</button>
        </div>
      </div>
    </div>
  );
}
