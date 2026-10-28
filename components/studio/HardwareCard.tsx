"use client";

import { Cloud, Cpu, Gauge, MonitorSmartphone } from "lucide-react";
import type { Hardware, Recommendation } from "@/lib/hardware";
import { useStudio } from "./state";

const TONE = {
  local: { box: "border-success/30 bg-success/[0.07]", text: "text-success", label: "Todo local" },
  mixed: { box: "border-warning/35 bg-warning/[0.07]", text: "text-warning", label: "Mixto" },
  external: { box: "border-accent/30 bg-accent/[0.07]", text: "text-accent", label: "APIs externas" },
};

function specs(h: Hardware) {
  return [
    ["GPU", h.gpu ?? "No disponible"],
    ["VRAM", h.vramGb !== null ? `${h.vramGb} GB${h.vramSource === "comfyui" ? " · medida por ComfyUI" : " · estimada por el modelo"}` : h.integrated ? "Integrada (compartida)" : "Desconocida"],
    ["RAM", h.ramGb !== null ? `${h.ramGb >= 8 ? "8 GB o más" : `${h.ramGb} GB`}` : "Desconocida"],
    ["Núcleos", h.cores !== null ? String(h.cores) : "Desconocido"],
  ];
}

/** Full view, in Settings → Tu equipo. */
export function HardwareCard({ hardware, rec, onRecheck }: { hardware: Hardware | null; rec: Recommendation | null; onRecheck: () => void }) {
  if (!hardware || !rec) return <p className="text-[13px] text-muted">Revisando tu equipo…</p>;
  const tone = TONE[rec.verdict];
  return (
    <div className="flex flex-col gap-4">
      <div className={`flex flex-col gap-2 rounded-xl border p-4 ${tone.box}`}>
        <span className={`text-[11px] font-bold tracking-[0.1em] ${tone.text}`}>RECOMENDACIÓN · {tone.label.toUpperCase()}</span>
        <p className="text-[15px] font-semibold">{rec.title}</p>
        {rec.reasons.map((r) => <p key={r} className="text-[13px] leading-normal text-muted">{r}</p>)}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-bg p-3">
          <span className="flex items-center gap-1.5 text-xs text-subtle"><Gauge className="size-3.5" /> Análisis</span>
          <span className="text-[13px]">{rec.analysis}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-bg p-3">
          <span className="flex items-center gap-1.5 text-xs text-subtle"><Cloud className="size-3.5" /> Imágenes</span>
          <span className="text-[13px]">{rec.images}</span>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-bg">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-[13px] font-semibold">
          {hardware.mobile ? <MonitorSmartphone className="size-4" /> : <Cpu className="size-4" />} Lo que detectamos
        </div>
        {specs(hardware).map(([k, v], i, all) => (
          <div key={k} className={`flex justify-between gap-4 px-4 py-2.5 text-[13px] ${i < all.length - 1 ? "border-b border-border" : ""}`}>
            <span className="text-subtle">{k}</span>
            <span className="text-right">{v}</span>
          </div>
        ))}
      </div>
      <p className="text-xs leading-normal text-subtle">
        El navegador no informa la VRAM: la estimamos por el modelo de tu GPU, o la leemos de ComfyUI si está conectado. Nada de esto sale de tu navegador.
      </p>
      <button onClick={onRecheck} className="w-fit rounded-[7px] bg-surface-2 px-3 py-2 text-[13px] font-medium">Volver a revisar</button>
    </div>
  );
}

/** Compact hint for the analysis and generate steps, shown only when a local option is picked but the machine isn't up to it. */
export function HardwareHint({ usingLocal }: { usingLocal: boolean }) {
  const { rec, openSettings } = useStudio();
  if (!rec || !usingLocal || rec.verdict === "local") return null;
  const tone = TONE[rec.verdict];
  return (
    <div className={`flex items-start justify-between gap-4 rounded-[10px] border px-4 py-3 ${tone.box}`}>
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-semibold">{rec.title}</p>
        <p className="text-[13px] leading-normal text-muted">{rec.reasons[0]} Sugerido: {rec.verdict === "external" ? rec.analysis + " para analizar y " + rec.images + " para generar." : rec.images + " para generar."}</p>
      </div>
      <button onClick={() => openSettings("hardware")} className="shrink-0 text-[13px] font-semibold underline">Ver mi equipo</button>
    </div>
  );
}
