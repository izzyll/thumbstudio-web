"use client";

import JSZip from "jszip";
import { Download, Loader2, WandSparkles } from "lucide-react";
import { useState } from "react";
import { LocalUnreachable } from "@/lib/analysis";
import { anton } from "@/lib/fonts";
import { addText, compareSheet, PREVIEW_SIZES, to16x9 } from "@/lib/image";
import { PROVIDERS, provider as getProvider } from "@/lib/providers";
import { HardwareHint } from "./HardwareCard";
import { type Result, useStudio } from "./state";
import { Button, ErrorNote, Radio } from "./ui";

const download = (blob: Blob, name: string) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

export function GenerateStep() {
  const s = useStudio();
  const { settings, saveSettings, local, concepts, picked, selected, content, channel, results, setResults, compareUrl, setCompareUrl } = s;
  const concept = concepts[picked];
  const [providerId, setProviderId] = useState(settings.imageProvider);
  const prov = getProvider(providerId);
  const models = prov.models(settings);
  const [model, setModel] = useState(prov.id === "comfyui" ? settings.comfyWorkflow : settings.imageModel || models[0]);
  const [n, setN] = useState(2);
  const [strength, setStrength] = useState(settings.styleStrength);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; local?: boolean } | null>(null);
  const [size, setSize] = useState(0);

  const ready = (id: string) => (id === "comfyui" ? local.comfyui === "ok" : getProvider(id).ready(settings));
  const pick = (id: string) => {
    setProviderId(id);
    const p = getProvider(id);
    setModel(id === "comfyui" ? settings.comfyWorkflow : p.models(settings)[0]);
  };
  // SDXL takes no style images; everything else gets the selected references.
  const usesStyleImages = !(prov.id === "comfyui" && model !== "flux");

  const run = async () => {
    setBusy(true);
    setError(null);
    setCompareUrl(null);
    const batch = crypto.randomUUID();
    setResults(Array.from({ length: n }, (_, i): Result => ({ key: `${batch}-${i}`, status: "pending" })));
    saveSettings({ ...settings, imageProvider: prov.id, styleStrength: strength, ...(prov.id === "comfyui" ? { comfyWorkflow: model as "sdxl" | "flux" } : { imageModel: model }) });
    try {
      const raw = await prov.generate(settings, {
        prompt: concept.image_prompt,
        n,
        model,
        contentImages: content ? [content.blob] : [],
        styleImages: usesStyleImages ? selected.map((r) => r.blob) : [],
        styleStrength: strength,
      });
      const done = await Promise.all(raw.map(async (b, i): Promise<Result> => {
        const titled = await addText(await to16x9(b), {
          text: concept.text,
          position: concept.position,
          color: concept.text_color,
          highlightWord: concept.highlight_word,
          highlightColor: concept.highlight_color,
          fontFamily: anton.style.fontFamily,
        });
        return { key: `${batch}-${i}`, status: "done", blob: titled, url: URL.createObjectURL(titled) };
      }));
      setResults(done);
      const sheet = await compareSheet(done.map((d) => d.blob!), selected.map((r) => r.bitmap));
      setCompareUrl(URL.createObjectURL(sheet));
    } catch (e) {
      setResults([]);
      setError({ text: e instanceof Error ? e.message : String(e), local: e instanceof LocalUnreachable });
    } finally {
      setBusy(false);
    }
  };

  const zipAll = async () => {
    const zip = new JSZip();
    results.forEach((r, i) => r.blob && zip.file(`miniatura-${i + 1}.png`, r.blob));
    download(await zip.generateAsync({ type: "blob" }), "miniaturas.zip");
  };

  const finished = results.filter((r) => r.status === "done");
  const [fw] = PREVIEW_SIZES[size];

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <aside className="flex flex-col gap-5 overflow-y-auto border-b border-border bg-surface p-4 sm:p-6 lg:w-[360px] lg:border-b-0 lg:border-r">
        <div className="flex flex-col gap-2.5">
          <p className="label">Dónde generar</p>
          <div className="overflow-hidden rounded-[10px] border border-border">
            {PROVIDERS.map((p, i) => {
              const ok = ready(p.id), sel = p.id === providerId;
              return (
                <button key={p.id} onClick={() => pick(p.id)} className={`flex w-full items-center gap-3 px-3.5 py-[11px] text-left ${sel ? "bg-surface-2" : "bg-bg"} ${ok ? "" : "opacity-60"} ${i < PROVIDERS.length - 1 ? "border-b border-border" : ""}`}>
                  <Radio on={sel} />
                  <span className="flex flex-1 flex-col">
                    <span className="text-sm font-semibold">{p.label}</span>
                    <span className="text-xs text-subtle">{p.sub}</span>
                  </span>
                  <span className={`text-xs ${ok ? "text-success" : "text-muted"}`}>{ok ? (p.local ? "Conectado" : "Key guardada") : p.local ? "Sin conexión" : "Sin key"}</span>
                </button>
              );
            })}
          </div>
          {!ready(providerId) && (
            <button onClick={() => s.openSettings(prov.local ? "local" : "keys")} className="text-left text-xs text-warning underline">
              Necesitas {prov.needs}. Configúralo en Ajustes.
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2.5">
          <p className="label">Modelo</p>
          {prov.id === "comfyui" ? (
            <div className="flex gap-[3px] rounded-lg border border-border bg-bg p-[3px]">
              {[["sdxl", "SDXL"], ["flux", "FLUX + Redux"]].map(([m, label]) => (
                <button key={m} onClick={() => setModel(m)} className={`flex-1 rounded-md py-2 text-[13px] ${model === m ? "bg-surface-2 font-semibold" : "text-muted"}`}>{label}</button>
              ))}
            </div>
          ) : (
            <select value={model} onChange={(e) => setModel(e.target.value)} className="rounded-lg border border-border bg-bg px-3 py-2.5 text-[13px] outline-none">
              {models.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
          {prov.id === "comfyui" && (
            <p className="text-xs leading-snug text-subtle">
              {model === "flux" ? "Con FLUX + Redux las referencias pasan como imagen y el look se acerca más al canal." : "SDXL no recibe las referencias como imagen: el estilo llega a través del prompt del análisis."}
            </p>
          )}
        </div>

        {usesStyleImages && (
          <div className="flex flex-col gap-2.5">
            <div className="flex justify-between"><p className="label">Fuerza del estilo</p><span className="text-[13px] font-semibold">{strength.toFixed(2)}</span></div>
            <input type="range" min={0.05} max={1} step={0.05} value={strength} onChange={(e) => setStrength(Number(e.target.value))} className="accent-accent" />
            <div className="flex justify-between text-[11px] text-subtle"><span>Solo el look</span><span>Más parecido</span></div>
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          <p className="label">Variaciones</p>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map((v) => (
              <button key={v} onClick={() => setN(v)} className={`flex-1 rounded-[7px] border py-2 text-[13px] font-semibold ${n === v ? "border-text bg-surface-2" : "border-border bg-bg text-muted"}`}>{v}</button>
            ))}
          </div>
        </div>

        <Button onClick={run} busy={busy} disabled={!ready(providerId) || !concept} className="mt-auto w-full">
          {!busy && <WandSparkles className="size-[17px]" />} {busy ? "Generando…" : `Generar ${n} miniatura${n > 1 ? "s" : ""}`}
        </Button>
      </aside>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4 sm:px-9 sm:py-7">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-[26px] sm:text-[30px]">Tus miniaturas</h1>
            <p className="text-[13px] text-subtle">Concepto {picked + 1} · {prov.label} · {model}{usesStyleImages ? ` · estilo ${strength.toFixed(2)}` : ""} · el título se añade en tu navegador</p>
          </div>
          {finished.length > 0 && (
            <button onClick={zipAll} className="flex items-center gap-1.5 rounded-lg bg-surface-2 px-3.5 py-2 text-[13px] font-medium"><Download className="size-[15px]" /> Descargar todo (.zip)</button>
          )}
        </div>

        <HardwareHint usingLocal={prov.local} />

        {error && (
          <ErrorNote action={error.local && <button onClick={() => s.openSettings("local")} className="shrink-0 font-semibold underline">Ver cómo</button>}>{error.text}</ErrorNote>
        )}

        {results.length === 0 && !error && (
          <div className="flex aspect-[32/9] items-center justify-center rounded-[10px] border border-dashed border-border text-sm text-muted">
            Elige dónde generar y pulsa “Generar”.
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-2">
          {results.map((r, i) => (
            <div key={r.key} className="flex flex-col gap-2.5">
              {r.status === "done" && r.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.url} alt={`Miniatura ${i + 1}`} className="aspect-video w-full rounded-[10px] object-cover" />
              ) : (
                <div className="flex aspect-video flex-col items-center justify-center gap-3.5 rounded-[10px] border border-border bg-surface">
                  <Loader2 className="size-7 animate-spin text-muted" />
                  <p className="text-sm">{prov.local ? "Generando en tu ComfyUI…" : `Generando con ${prov.label}…`}</p>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-subtle">Variación {i + 1}{r.status === "done" ? " · 1280×720" : ""}</span>
                {r.blob && (
                  <button onClick={() => download(r.blob!, `miniatura-${i + 1}.png`)} className="flex items-center gap-1.5 rounded-[7px] border border-border px-2.5 py-1.5 text-xs">
                    <Download className="size-3.5 text-muted" /> PNG
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {finished.length > 0 && (
          <div className="flex flex-col gap-3.5 rounded-[14px] border border-border bg-feed p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[15px] font-semibold">¿Destaca en el feed de {channel?.name}?</p>
              <div className="flex gap-1.5">
                {["Inicio", "Sugeridos", "Móvil"].map((label, i) => (
                  <button key={label} onClick={() => setSize(i)} className={`rounded-full border px-2.5 py-1 text-xs ${size === i ? "border-text bg-surface-2" : "border-border text-muted"}`}>{label}</button>
                ))}
              </div>
            </div>
            {/* "Inicio" fills the row like the design; the other sizes show the real pixel widths viewers see. */}
            <div className={`flex gap-3 ${size === 0 ? "" : "flex-wrap"}`}>
              {[...selected.slice(0, 2).map((r) => ({ url: r.url, mine: false })), ...finished.map((r) => ({ url: r.url!, mine: true })), ...selected.slice(2, 5).map((r) => ({ url: r.url, mine: false }))].map((t, i) => (
                <div key={i} className={`flex flex-col gap-[7px] ${size === 0 ? "min-w-0 flex-1" : "shrink-0"}`} style={size === 0 ? undefined : { width: fw }}>
                  <div className="relative overflow-hidden rounded-md">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={t.url} alt="" className="aspect-video w-full object-cover" />
                    {t.mine && <span className="absolute inset-x-0 bottom-0 h-[5px] bg-accent" />}
                  </div>
                  <span className={`h-[7px] rounded-[3px] ${t.mine ? "bg-accent/40" : "bg-border"}`} />
                  <span className="h-[5px] w-[60px] rounded-[3px] bg-surface-2" />
                </div>
              ))}
            </div>
            {compareUrl && (
              <a href={compareUrl} download="comparacion-feed.png" className="text-xs text-muted underline">Descargar la comparación como imagen</a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
