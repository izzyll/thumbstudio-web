"use client";

import { ArrowLeft, ImagePlus, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { analyze, LLMS, type LlmId, LocalUnreachable } from "@/lib/analysis";
import { blobToBase64, contactSheet } from "@/lib/image";
import { HardwareHint } from "./HardwareCard";
import { useStudio } from "./state";
import { Button, ErrorNote, Radio, StatusDot } from "./ui";

const ORDER: LlmId[] = ["ollama", "gemini", "anthropic", "openai", "compat"];

export function VideoStep() {
  const s = useStudio();
  const { settings, local, llm, setLlm, myVideo, setMyVideo, content, setContent, selected, channel, profile } = s;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; local?: boolean } | null>(null);

  const state = (id: LlmId): { ok: boolean; text: string; action?: "key" | "local" } => {
    if (id === "ollama" || id === "compat") {
      const st = local[id === "ollama" ? "ollama" : "compat"];
      return st === "ok" ? { ok: true, text: "Conectado" } : { ok: false, text: st === "unknown" ? "Comprobando…" : "Sin conexión", action: "local" };
    }
    return LLMS[id].ready(settings) ? { ok: true, text: "Key guardada" } : { ok: false, text: "Falta tu API key", action: "key" };
  };

  // If the preferred model isn't usable (no key, service down), start on the first one that is.
  const firstReady = ORDER.find((id) => state(id).ok);
  useEffect(() => {
    if (!state(llm).ok && firstReady) setLlm(firstReady);
    // Only when availability changes, not on every manual pick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstReady]);

  const run = async () => {
    setBusy(true);
    setError(null);
    const started = performance.now();
    try {
      const sheet = await contactSheet(selected.map((r) => r.bitmap), selected.map((r) => `${r.views.toLocaleString("en-US")} views`));
      const result = await analyze(settings, llm, await blobToBase64(sheet), selected, profile, myVideo);
      s.setAnalysis({ ...result, meta: { llm, seconds: Math.round((performance.now() - started) / 1000) } });
      s.setConcepts(result.concepts);
      s.setPicked(0);
      s.setStep(2);
    } catch (e) {
      setError({ text: e instanceof Error ? e.message : String(e), local: e instanceof LocalUnreachable });
    } finally {
      setBusy(false);
    }
  };

  const ready = state(llm).ok && myVideo.trim().length > 5;

  return (
    <div className="flex flex-1 justify-center overflow-y-auto px-4 py-8 sm:px-10 sm:py-14">
      <div className="flex w-full max-w-[760px] flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-[32px] sm:text-[40px]">¿De qué trata tu video?</h1>
          <p className="text-[15px] leading-normal text-muted">
            Usaremos el estilo de {selected.length} miniaturas de {channel?.name}. El tema y el título salen de lo que escribas aquí.
          </p>
        </div>

        <label className="flex flex-col gap-2">
          <span className="flex justify-between text-sm font-semibold">Título o tema <span className="font-normal text-subtle">Requerido</span></span>
          <textarea
            value={myVideo}
            onChange={(e) => setMyVideo(e.target.value)}
            placeholder="Ej.: Probé un celular plegable de $200 durante 30 días. ¿Vale la pena?"
            className="h-[132px] resize-none rounded-[10px] border border-border bg-surface p-4 text-[15px] leading-[23px] outline-none placeholder:text-subtle focus:border-text"
          />
        </label>

        <div className="flex flex-col gap-2">
          <span className="flex justify-between text-sm font-semibold">Tu cara o un frame del video <span className="font-normal text-subtle">Opcional · se mantiene reconocible</span></span>
          {content ? (
            <div className="flex items-center gap-4 rounded-[10px] border border-border bg-surface p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={content.url} alt="" className="h-16 w-28 rounded-md object-cover" />
              <span className="flex-1 text-sm text-muted">Se usará como contenido de la miniatura.</span>
              <button onClick={() => setContent(null)} aria-label="Quitar imagen" className="p-2 text-muted hover:text-text"><X className="size-4" /></button>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center gap-4 rounded-[10px] border-[1.5px] border-border bg-surface p-5 hover:border-subtle">
              <span className="flex size-11 items-center justify-center rounded-lg bg-surface-2"><ImagePlus className="size-5 text-muted" /></span>
              <span className="flex flex-col gap-0.5">
                <span className="text-sm">Arrastra una imagen o haz clic para elegirla</span>
                <span className="text-xs text-subtle">PNG o JPG. Se procesa en tu navegador.</span>
              </span>
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setContent({ blob: f, url: URL.createObjectURL(f) });
              }} />
            </label>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Modelo para analizar el estilo</span>
          <div className="overflow-hidden rounded-[10px] border border-border">
            {ORDER.map((id, i) => {
              const st = state(id), sel = llm === id;
              return (
                <div key={id} className={`flex items-center gap-3.5 px-4 py-3.5 ${sel ? "bg-surface-2" : "bg-surface"} ${i < ORDER.length - 1 ? "border-b border-border" : ""}`}>
                  <button onClick={() => setLlm(id)} className="flex flex-1 items-center gap-3.5 text-left">
                    <Radio on={sel} />
                    <span className="flex flex-col gap-0.5">
                      <span className={`text-sm font-semibold ${st.ok ? "" : "text-muted"}`}>
                        {LLMS[id].label}{id === "ollama" ? ` · ${settings.ollamaModel}` : ""}
                      </span>
                      <span className="text-xs text-subtle">{LLMS[id].sub}</span>
                    </span>
                  </button>
                  <span className="flex items-center gap-1.5 text-xs text-muted"><StatusDot state={st.ok ? "ok" : st.action === "key" ? "warn" : "off"} />{st.text}</span>
                  {st.action && (
                    <button onClick={() => s.openSettings(st.action === "key" ? "keys" : "local")} className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium">
                      {st.action === "key" ? "Agregar key" : "Cómo conectar"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <HardwareHint usingLocal={LLMS[llm].local} />

        {error && (
          <ErrorNote action={error.local && <button onClick={() => s.openSettings("local")} className="shrink-0 font-semibold underline">Ver cómo</button>}>
            {error.text}
          </ErrorNote>
        )}

        <div className="flex items-center justify-between">
          <button onClick={() => s.setStep(0)} className="flex items-center gap-1.5 text-sm text-muted hover:text-text"><ArrowLeft className="size-4" /> Cambiar referencias</button>
          <Button onClick={run} busy={busy} disabled={!ready}>
            {!busy && <Sparkles className="size-[17px]" />} {busy ? "Analizando…" : "Analizar estilo"}
          </Button>
        </div>
      </div>
    </div>
  );
}
