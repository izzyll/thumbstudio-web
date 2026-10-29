// Reachability of the visitor's local services (Ollama, ComfyUI, OpenAI-compatible server).
"use client";

import { useCallback, useEffect, useState } from "react";
import { ping } from "./analysis";
import { type Settings, trimSlash } from "./settings";

export type LocalService = "ollama" | "comfyui" | "compat";
/** "cors": the service is running but doesn't allow this site; "off": nothing answers at that URL. */
export type LocalStatus = "ok" | "cors" | "off" | "unknown";
export type LocalState = Record<LocalService, LocalStatus>;

export const LOCAL_LABELS: Record<LocalService, string> = { ollama: "Ollama", comfyui: "ComfyUI", compat: "LM Studio / compatible" };

export const healthUrl = (s: Settings, service: LocalService) =>
  ({ ollama: `${trimSlash(s.ollamaUrl)}/api/tags`, comfyui: `${trimSlash(s.comfyUrl)}/system_stats`, compat: `${trimSlash(s.compatUrl)}/models` })[service];

/** A failed CORS fetch looks the same as a closed port. A no-cors request tells them apart: it resolves (with an
 * opaque response) whenever something is listening, whatever its CORS headers. */
async function probe(url: string): Promise<LocalStatus> {
  if (await ping(url)) return "ok";
  try {
    await fetch(url, { mode: "no-cors", signal: AbortSignal.timeout(2500) });
    return "cors";
  } catch {
    return "off";
  }
}

export function useLocalStatus(s: Settings) {
  const [state, setState] = useState<LocalState>({ ollama: "unknown", comfyui: "unknown", compat: "unknown" });
  const check = useCallback(async (only?: LocalService) => {
    const services: LocalService[] = only ? [only] : ["ollama", "comfyui", "compat"];
    const results = await Promise.all(services.map((sv) => probe(healthUrl(s, sv))));
    setState((prev) => {
      const next = { ...prev };
      services.forEach((sv, i) => (next[sv] = results[i]));
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

// Chrome's Local Network Access permission, which gates fetches from this site to 127.0.0.1. Its name changed
// across versions ("local-network-access", later split into "loopback-network" / "local-network").
const LNA_NAMES = ["loopback-network", "local-network-access", "local-network"];

/** "denied" means the visitor blocked local access for this site: CORS settings can't fix that. */
export function useLocalNetworkPermission() {
  const [state, setState] = useState<PermissionState | "unsupported">("unsupported");
  useEffect(() => {
    let status: PermissionStatus | undefined;
    const update = () => status && setState(status.state);
    (async () => {
      for (const name of LNA_NAMES) {
        try {
          status = await navigator.permissions.query({ name: name as PermissionName });
          update();
          status.addEventListener("change", update);
          return;
        } catch {
          // Unknown permission name in this browser: try the next one.
        }
      }
    })();
    return () => status?.removeEventListener("change", update);
  }, []);
  return state;
}

/** The origin the visitor's local services must allow (CORS). */
export function siteOrigin() {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://ts.dgdev.cl";
}

/** How to let this site in (`command` + `allow`) and, when nothing answers, how to start the service (`open`). */
export function corsHelp(service: LocalService, origin: string) {
  if (service === "ollama") {
    return {
      command: `setx OLLAMA_ORIGINS "${origin}"`,
      allow: `Windows: ejecútalo en PowerShell y cierra Ollama del todo (ícono de la bandeja → Quit), luego ábrelo de nuevo: solo lee la variable al arrancar. macOS: launchctl setenv OLLAMA_ORIGINS "${origin}" y reinicia Ollama. Linux: Environment="OLLAMA_ORIGINS=${origin}" en el servicio. Si lo usas desde más de un sitio, separa los orígenes con coma.`,
      open: "Ábrelo desde el menú de inicio o ejecuta ollama serve. Para analizar necesitas un modelo con visión: ollama pull qwen2.5vl:7b",
    };
  }
  if (service === "comfyui") {
    return {
      command: `--enable-cors-header ${origin}`,
      allow: "ComfyUI Desktop: en el panel de instalaciones, abre los ajustes de tu instalación y súmalo a “Launch arguments” (junto a --enable-manager), luego reinicia ComfyUI. Versiones antiguas: Settings → Server-Config → Enable CORS header. Portable o manual: añádelo al comando de python main.py.",
      open: "Abre ComfyUI y espera a que cargue. Si usa otro puerto (ComfyUI Desktop a veces usa 8000), cambia la URL de arriba.",
    };
  }
  return {
    command: "Developer → Server Settings → Enable CORS",
    allow: "En LM Studio activa CORS y carga un modelo con visión. La URL termina en /v1.",
    open: "Abre LM Studio y en Developer inicia el servidor (Start Server). Si no lo usas, ignóralo.",
  };
}
