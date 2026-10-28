"use client";

import { ArrowRight, Ban, RefreshCw } from "lucide-react";
import { type Concept, LLMS } from "@/lib/analysis";
import { useStudio } from "./state";
import { Button } from "./ui";

const PATTERN_LABELS: Record<string, string> = {
  framing: "Encuadre", faces: "Rostros", elements: "Elementos", palette: "Paleta", contrast: "Contraste", background: "Fondo", text: "Texto",
};
const POSITIONS: [Concept["position"], string][] = [["left", "Izq."], ["right", "Der."], ["top", "Arriba"], ["bottom", "Abajo"], ["center", "Centro"]];

/** Rough preview of the title on the visitor's image (or a dark frame): the real render happens after generation. */
function Preview({ c, image }: { c: Concept; image?: string }) {
  const words = c.text.replace(/\\n/g, "\n").toUpperCase();
  const hl = c.highlight_word?.toUpperCase();
  const align = { left: "items-start text-left", right: "items-end text-right", top: "items-center justify-start text-center", bottom: "items-center justify-end text-center", center: "items-center text-center" }[c.position] ?? "items-start";
  return (
    <div className={`relative flex h-[178px] flex-col justify-center overflow-hidden rounded-lg bg-[linear-gradient(135deg,#1e1e21,#0b0b0c)] p-3.5 ${align}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {image && <img src={image} alt="" className="absolute inset-0 size-full object-cover" />}
      {/* Shade on the title side, as in the design, so the words read over any image. */}
      <span className={`absolute inset-y-0 w-[150px] ${c.position === "right" ? "right-0 bg-[linear-gradient(270deg,#000000CC,#00000000)]" : "left-0 bg-[linear-gradient(90deg,#000000CC,#00000000)]"}`} />
      <p className="relative font-display text-[30px] leading-[1.05]" style={{ color: c.text_color || "#fff" }}>
        {words.split("\n").map((line, i) => (
          <span key={i} className="block">
            {line.split(" ").map((w, j) => (
              <span key={j} style={w.replace(/[.,!?¡¿]/g, "") === hl ? { color: c.highlight_color || "#FFD400" } : undefined}>{w} </span>
            ))}
          </span>
        ))}
      </p>
    </div>
  );
}

export function AnalysisStep() {
  const s = useStudio();
  const { analysis, concepts, setConcepts, picked, setPicked, selected, channel, content } = s;
  if (!analysis) return null;
  const meta = analysis.meta;
  const edit = (i: number, patch: Partial<Concept>) => setConcepts(concepts.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <aside className="flex flex-col gap-5 overflow-y-auto border-b border-border bg-surface p-4 sm:p-7 lg:w-[380px] lg:border-b-0 lg:border-r">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">El estilo de {channel?.name}</h2>
          {meta && <p className="text-xs text-subtle">Analizado con {LLMS[meta.llm].label} · {meta.seconds} s</p>}
        </div>
        <div className="flex flex-col gap-3.5">
          {Object.entries(analysis.style_patterns).map(([k, v]) => (
            <div key={k} className="flex flex-col gap-0.5">
              <p className="label">{PATTERN_LABELS[k] ?? k}</p>
              <p className="text-sm leading-snug">{v}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2.5 rounded-[10px] border border-accent/25 bg-accent/[0.07] p-4">
          <p className="flex items-center gap-2 text-[13px] font-semibold"><Ban className="size-[15px] text-accent" /> No copiaremos</p>
          <div className="flex flex-wrap gap-1.5">
            {analysis.avoid.map((a) => <span key={a} className="rounded-full border border-border bg-bg px-2.5 py-1 text-xs text-muted">{a}</span>)}
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4 sm:px-9 sm:py-7">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-[26px] sm:text-[30px]">{concepts.length} conceptos para tu video</h1>
          <button onClick={() => s.setStep(1)} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-[7px] text-[13px] text-muted hover:text-text">
            <RefreshCw className="size-3.5" /> Volver a analizar
          </button>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          {concepts.map((c, i) => {
            const sel = picked === i;
            return (
              <div key={i} onClick={() => setPicked(i)} className={`flex cursor-pointer flex-col gap-3.5 rounded-[14px] border bg-surface p-4 ${sel ? "border-[1.5px] border-accent" : "border-border"}`}>
                <Preview c={c} image={content?.url} />
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-bold tracking-[0.1em] ${sel ? "text-accent" : "text-subtle"}`}>CONCEPTO {i + 1}</span>
                  {c.best_reference_numbers?.length > 0 && <span className="text-[11px] text-subtle">estilo de #{c.best_reference_numbers.join(", #")}</span>}
                </div>
                <p className="text-[15px] font-semibold">{c.idea}</p>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs text-subtle">Título</span>
                  <input value={c.text.replace(/\n/g, " / ")} onChange={(e) => edit(i, { text: e.target.value.replace(/ \/ /g, "\n") })} className="rounded-[7px] border border-border bg-bg px-3 py-2 text-[13px] outline-none focus:border-text" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs text-subtle">Palabra resaltada</span>
                  <input value={c.highlight_word} onChange={(e) => edit(i, { highlight_word: e.target.value })} className="rounded-[7px] border border-border bg-bg px-3 py-2 text-[13px] outline-none focus:border-text" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs text-subtle">Prompt de imagen</span>
                  <textarea value={c.image_prompt} rows={4} onChange={(e) => edit(i, { image_prompt: e.target.value })} className="resize-none rounded-[7px] border border-border bg-bg px-3 py-2 text-[13px] leading-snug outline-none focus:border-text" />
                </label>
                <div className="flex gap-1">
                  {POSITIONS.map(([p, label]) => (
                    <button key={p} onClick={(e) => { e.stopPropagation(); edit(i, { position: p }); }} className={`flex-1 rounded-md border py-1.5 text-xs ${c.position === p ? "border-text bg-surface-2" : "border-border bg-bg text-muted"}`}>{label}</button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-2.5">
          <p className="label">Referencias de estilo · {selected.length}</p>
          <div className="flex gap-2 overflow-x-auto">
            {selected.map((r, i) => (
              <div key={r.id} className="relative w-32 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.url} alt="" className="aspect-video w-full rounded-md object-cover" />
                <span className="absolute left-1.5 top-1.5 rounded bg-bg/80 px-1.5 text-[10px] font-bold">#{i + 1}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-auto flex items-center justify-end gap-4 pt-2">
          <span className="hidden text-[13px] text-subtle sm:inline">Puedes editar cualquier campo antes de generar</span>
          <Button onClick={() => s.setStep(3)}>Generar con el concepto {picked + 1} <ArrowRight className="size-[18px]" /></Button>
        </div>
      </div>
    </div>
  );
}
