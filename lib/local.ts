// Reachability of the visitor's local services (Ollama, ComfyUI, OpenAI-compatible server).
"use client";

import { useCallback, useEffect, useState } from "react";
import { ping } from "./analysis";
import { type Settings, trimSlash } from "./settings";

export type LocalService = "ollama" | "comfyui" | "compat";
export type LocalState = Record<LocalService, "ok" | "off" | "unknown">;

export const LOCAL_LABELS: Record<LocalService, string> = { ollama: "Ollama", comfyui: "ComfyUI", compat: "LM Studio / compatible" };

export const healthUrl = (s: Settings, service: LocalService) =>
  ({ ollama: `${trimSlash(s.ollamaUrl)}/api/tags`, comfyui: `${trimSlash(s.comfyUrl)}/system_stats`, compat: `${trimSlash(s.compatUrl)}/models` })[service];

export function useLocalStatus(s: Settings) {
  const [state, setState] = useState<LocalState>({ ollama: "unknown", comfyui: "unknown", compat: "unknown" });
  const check = useCallback(async (only?: LocalService) => {
    const services: LocalService[] = only ? [only] : ["ollama", "comfyui", "compat"];
    const results = await Promise.all(services.map((sv) => ping(healthUrl(s, sv))));
    setState((prev) => {
      const next = { ...prev };
      services.forEach((sv, i) => (next[sv] = results[i] ? "ok" : "off"));
      return next;
    });
  }, [s]);
  useEffect(() => {
    // Checking is a fetch to localhost; the state update lands asynchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void check();
  }, [check]);
  return { state, check };
}

/** The origin the visitor's local services must allow (CORS). */
export function siteOrigin() {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://ts.dgdev.cl";
}

export function corsHelp(service: LocalService, origin: string) {
  if (service === "ollama") {
    return {
      command: `setx OLLAMA_ORIGINS "${origin}"`,
      note: `Windows: ejecútalo y reinicia Ollama. macOS: launchctl setenv OLLAMA_ORIGINS "${origin}". Linux: Environment="OLLAMA_ORIGINS=${origin}" en el servicio. Para analizar necesitas un modelo con visión: ollama pull qwen2.5vl:7b`,
    };
  }
  if (service === "comfyui") {
    return {
      command: `--enable-cors-header ${origin}`,
      note: "Agrégalo a los argumentos de arranque. ComfyUI Desktop: en el panel de instalaciones, abre los ajustes de tu instalación y súmalo a “Launch arguments” (junto a --enable-manager); reinicia ComfyUI. Versiones antiguas: Settings → Server-Config → Enable CORS header. Portable o manual: añádelo al comando de python main.py. Si Chrome pide permiso de “acceso a la red local”, acéptalo.",
    };
  }
  return { command: "Developer → Server Settings → Enable CORS", note: "En LM Studio activa CORS y carga un modelo con visión. La URL termina en /v1." };
}
