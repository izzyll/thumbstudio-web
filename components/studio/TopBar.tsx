"use client";

import { Check, Settings2 } from "lucide-react";
import { Fragment } from "react";
import { Brand } from "@/components/Brand";
import { LOCAL_LABELS, type LocalService } from "@/lib/local";
import { useStudio } from "./state";
import { StatusDot } from "./ui";

export const STEP_NAMES = ["Canal", "Tu video", "Análisis", "Generar"];

export function TopBar() {
  const { step, setStep, maxStep, local, openSettings } = useStudio();
  const up = (Object.keys(local) as LocalService[]).filter((s) => local[s] === "ok");
  return (
    <>
      <header className="flex h-16 items-center justify-between border-b border-border bg-bg px-4 sm:px-6">
        <div className="w-[260px]"><Brand size="sm" /></div>
        <nav className="hidden items-center gap-1.5 md:flex">
          {STEP_NAMES.map((name, i) => {
            const done = i < step, active = i === step, reachable = i <= maxStep;
            return (
              <Fragment key={name}>
                {i > 0 && <span className="h-px w-5 bg-border" />}
                <button
                  disabled={!reachable}
                  onClick={() => setStep(i)}
                  className={`flex items-center gap-2 rounded-full px-3 py-[7px] text-[13px] ${active ? "bg-surface-2 font-semibold" : "font-medium"} ${active || done ? "text-text" : "text-muted"} disabled:cursor-default`}
                >
                  <span className={`flex size-5 items-center justify-center rounded-full text-[11px] font-bold ${active ? "bg-accent text-white" : done ? "border border-success/40 bg-success/10 text-success" : "border border-border bg-surface-2 text-muted"}`}>
                    {done ? <Check className="size-3" /> : i + 1}
                  </span>
                  {name}
                </button>
              </Fragment>
            );
          })}
        </nav>
        <div className="flex w-[260px] items-center justify-end gap-2.5">
          <button onClick={() => openSettings("local")} className="hidden items-center gap-2 rounded-full border border-border px-3 py-[7px] text-xs text-muted sm:flex">
            <StatusDot state={up.length ? "ok" : "off"} />
            {up.length ? up.map((s) => LOCAL_LABELS[s].split(" ")[0]).join(" · ") : "Sin modelos locales"}
          </button>
          <button onClick={() => openSettings()} className="flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-[7px] text-[13px] font-medium">
            <Settings2 className="size-[15px]" /> <span className="hidden sm:inline">Ajustes</span>
          </button>
        </div>
      </header>
      {/* Mobile: step label + progress */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2 md:hidden">
        <span className="text-[11px] font-bold tracking-[0.1em] text-accent">PASO {step + 1} DE 4 · {STEP_NAMES[step].toUpperCase()}</span>
      </div>
      <div className="h-[3px] bg-surface-2 md:hidden"><div className="h-full bg-accent" style={{ width: `${((step + 1) / 4) * 100}%` }} /></div>
    </>
  );
}

export function QuotaBanner() {
  return (
    <div className="flex items-center gap-3 border-b border-warning/30 bg-warning/10 px-6 py-3 text-sm">
      <span className="text-warning">⏳</span>
      No podemos procesar tu solicitud hoy: se alcanzó el límite diario de YouTube. Vuelve mañana; los canales ya consultados siguen disponibles.
    </div>
  );
}
