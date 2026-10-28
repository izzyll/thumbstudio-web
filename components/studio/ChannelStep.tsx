"use client";

import { ArrowRight, AtSign, Check, Hourglass } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadImage, thumbUrl } from "@/lib/image";
import type { TopVideos } from "@/lib/types";
import { type Ref, useStudio } from "./state";
import { Button, ErrorNote } from "./ui";

const RECENT_KEY = "thumbstudio.recent";

const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} M` : n >= 1e3 ? `${Math.round(n / 1e3)} K` : String(n));

function recentChannels(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function rememberChannel(handle: string) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([handle, ...recentChannels().filter((h) => h !== handle)].slice(0, 5)));
  } catch {
    // Storage blocked: the list just isn't kept.
  }
}

export function ChannelStep({ initial }: { initial: string }) {
  const { channel, setChannel, refs, setRefs, selected, profile, quota, setQuota, setStep } = useStudio();
  const [input, setInput] = useState(channel?.handle ?? initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const autoloaded = useRef(false);

  const load = useCallback(async (handle: string) => {
    handle = handle.trim();
    if (!handle) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/channel/top?${new URLSearchParams({ handle, n: "8" })}`);
      // A non-JSON answer means the API itself isn't there (in development: `npm run dev:api` isn't running).
      const data = await res.json().catch(() => {
        throw new Error(
          process.env.NODE_ENV === "development"
            ? "La API local no responde. Abre otra terminal y ejecuta: npm run dev:api"
            : "El servidor no respondió. Prueba de nuevo en unos minutos.",
        );
      });
      if (res.status === 429 && data.code === "quota") {
        setQuota(true);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "No pudimos leer el canal.");
      const top = data as TopVideos;
      if (!top.videos.length) throw new Error("Ese canal no tiene videos largos recientes.");
      const loaded: Ref[] = await Promise.all(top.videos.map(async (v) => {
        const blob = await (await fetch(thumbUrl(v.id))).blob();
        return { ...v, blob, bitmap: await loadImage(blob), url: URL.createObjectURL(blob), on: true };
      }));
      setRefs(loaded);
      setChannel({ name: top.channel, scanned: top.scanned, handle });
      rememberChannel(handle);
      setRecent(recentChannels());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [setChannel, setQuota, setRefs]);

  useEffect(() => {
    // Reading localStorage only works after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecent(recentChannels());
    if (initial && !channel && !autoloaded.current) {
      autoloaded.current = true;
      void load(initial);
    }
  }, [initial, channel, load]);

  const toggle = (id: string) => setRefs((prev) => prev.map((r) => (r.id === id ? { ...r, on: !r.on } : r)));

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4 sm:px-10 sm:py-8">
        <form className="flex gap-3" onSubmit={(e) => { e.preventDefault(); void load(input); }}>
          <label className="flex h-11 w-full max-w-[420px] items-center gap-2.5 rounded-lg border border-border bg-surface px-3.5">
            <AtSign className="size-4 text-subtle" />
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="canal o URL de YouTube" aria-label="Canal" className="w-full bg-transparent text-[15px] outline-none placeholder:text-subtle" />
          </label>
          <Button type="submit" variant="secondary" busy={busy}>Buscar</Button>
        </form>

        {error && <ErrorNote>{error}</ErrorNote>}

        {quota && !refs.length ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3.5 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-[14px] bg-warning/10"><Hourglass className="size-6 text-warning" /></span>
            <h2 className="font-display text-[32px]">Llegamos al límite de hoy</h2>
            <p className="max-w-[460px] text-[15px] leading-relaxed text-muted">
              YouTube nos da una cuota diaria compartida entre todos los visitantes. Se reinicia a medianoche (hora del Pacífico).
            </p>
            {recent.length > 0 && (
              <div className="flex flex-col items-center gap-2 pt-3">
                <p className="text-xs text-subtle">Disponibles desde la caché</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {recent.map((h) => (
                    <button key={h} onClick={() => { setInput(h); void load(h); }} className="rounded-full border border-border bg-surface px-3 py-1.5 text-[13px]">{h}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : !refs.length ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center text-muted">
            {busy ? <p>Buscando los videos más vistos…</p> : (
              <>
                <p className="font-display text-3xl text-text">¿Qué canal quieres estudiar?</p>
                <p className="text-[15px]">Escribe su @handle. Traemos sus videos más vistos entre los últimos 200, sin Shorts.</p>
                {recent.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-2 pt-2">
                    {recent.map((h) => (
                      <button key={h} onClick={() => { setInput(h); void load(h); }} className="rounded-full border border-border bg-surface px-3 py-1.5 text-[13px] text-text">{h}</button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
              <div className="flex flex-col gap-1.5">
                <h1 className="font-display text-[28px] sm:text-[34px]">{channel?.name}</h1>
                <p className="text-sm text-muted">Los {refs.length} videos más vistos entre sus últimas {channel?.scanned} subidas · Shorts excluidos</p>
              </div>
              <p className="text-[13px] text-subtle">Haz clic en una miniatura para quitarla de las referencias</p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
              {refs.map((r, i) => (
                <button
                  key={r.id}
                  onClick={() => toggle(r.id)}
                  className={`flex flex-col gap-2.5 rounded-xl border p-2 text-left transition-opacity ${r.on ? "border-border bg-surface" : "border-border opacity-45"}`}
                >
                  <div className="relative aspect-video overflow-hidden rounded-[7px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.url} alt={r.title} className="size-full object-cover" />
                    <span className={`absolute left-2.5 top-2.5 flex size-6 items-center justify-center rounded-full ${r.on ? "bg-accent" : "border-[1.5px] border-white/40 bg-bg/70"}`}>
                      {r.on && <Check className="size-3.5 text-white" />}
                    </span>
                    <span className="absolute bottom-2.5 left-2.5 rounded-[5px] bg-bg/80 px-2 py-0.5 text-xs font-bold">{i + 1}</span>
                  </div>
                  <div className="flex flex-col gap-1.5 px-1 pb-1">
                    <p className="line-clamp-2 text-sm font-semibold">{r.title}</p>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-xs text-muted">{fmt(r.views)} vistas</span>
                      {r.outlierScore && (
                        <span className="rounded-full bg-highlight/10 px-[7px] py-0.5 text-[11px] font-semibold text-highlight">{r.outlierScore}× la mediana</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {refs.length > 0 && (
        <aside className="flex flex-col gap-7 border-t border-border bg-surface p-4 sm:p-7 lg:w-[360px] lg:border-l lg:border-t-0">
          <h2 className="text-lg font-semibold">Perfil de estilo</h2>
          {profile ? (
            <>
              <div className="flex flex-col gap-3">
                <p className="label">Paleta compartida</p>
                <div className="flex gap-1.5">
                  {profile.palette.map((p) => (
                    <div key={p.hex} className="flex flex-1 flex-col items-center gap-1.5">
                      <span className="h-10 w-full rounded-md border border-border" style={{ background: p.hex }} title={p.hex} />
                      <span className="text-[11px] text-muted">{Math.round(p.share * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <p className="label">Medidas</p>
                {[
                  ["Brillo", profile.avgBrightness, profile.avgBrightness < 0.4 ? "oscuro" : profile.avgBrightness > 0.65 ? "claro" : "medio"],
                  ["Saturación", profile.avgSaturation, profile.avgSaturation > 0.5 ? "intensa" : profile.avgSaturation < 0.25 ? "apagada" : "media"],
                ].map(([name, value, word]) => (
                  <div key={name as string} className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[13px]"><span>{name}</span><span className="text-muted">{(value as number).toFixed(2)} · {word}</span></div>
                    <div className="h-1.5 rounded-full bg-surface-2"><div className="h-full rounded-full bg-text" style={{ width: `${(value as number) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-3">
                <p className="label">Espacio para el título</p>
                <div className="flex gap-2">
                  {(["left", "right"] as const).map((side) => {
                    const n = profile.calmerSideCounts[side], on = n >= profile.calmerSideCounts[side === "left" ? "right" : "left"];
                    return (
                      <div key={side} className={`flex flex-1 flex-col gap-1 rounded-lg border p-3.5 ${on ? "border-highlight/35 bg-highlight/10" : "border-border bg-bg"}`}>
                        <span className={`text-[13px] font-semibold ${on ? "text-highlight" : ""}`}>{side === "left" ? "Izquierda" : "Derecha"}</span>
                        <span className="text-xs text-muted">{n} de {selected.length} miniaturas</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">Elige al menos una miniatura.</p>
          )}
          <div className="mt-auto flex flex-col gap-2.5">
            <p className="text-[13px] text-muted">{selected.length} de {refs.length} miniaturas como referencia</p>
            <Button disabled={!selected.length} onClick={() => setStep(1)} className="w-full">
              Continuar: describe tu video <ArrowRight className="size-[18px]" />
            </Button>
          </div>
        </aside>
      )}
    </div>
  );
}
