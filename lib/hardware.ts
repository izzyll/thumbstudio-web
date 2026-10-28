// What the visitor's machine can run locally, so the studio can suggest external APIs when it can't.
// Browsers don't expose VRAM: we use ComfyUI's /system_stats when it's connected (exact), otherwise the GPU name from
// WebGPU/WebGL mapped to known cards (estimate).
"use client";

import { type Settings, trimSlash } from "./settings";

export type Hardware = {
  gpu: string | null;
  vendor: "nvidia" | "amd" | "intel" | "apple" | "other" | null;
  integrated: boolean;
  vramGb: number | null;
  vramSource: "comfyui" | "estimate" | null;
  ramGb: number | null; // navigator.deviceMemory caps at 8
  cores: number | null;
  mobile: boolean;
};

export type Verdict = "local" | "mixed" | "external";

export type Recommendation = {
  verdict: Verdict;
  title: string;
  reasons: string[];
  analysis: string;
  images: string;
};

// Desktop/laptop VRAM by model number. Laptop variants can have less; they're flagged as estimates.
const NVIDIA_VRAM: [RegExp, number][] = [
  [/5090/, 32], [/4090|3090/, 24], [/5080|4080|5070 ti|4070 ti super/, 16], [/4070 ti|4070 super|4070|5070|3080 ti|3060(?! ti)/, 12],
  [/3080/, 10], [/5060|4060|3070|3060 ti|2080|2070|2060 super|1080|1070/, 8], [/2060|1660|1060/, 6], [/3050|1650|1050/, 4],
];
const AMD_VRAM: [RegExp, number][] = [
  [/7900 xtx/, 24], [/7900/, 20], [/7800|6800|6900|9070/, 16], [/7700|6700/, 12], [/7600|6600|5700/, 8], [/6500|5500/, 4],
];

async function gpuName(): Promise<string | null> {
  try {
    const nav = navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ info?: { description?: string; vendor?: string; architecture?: string } } | null> } };
    const adapter = await nav.gpu?.requestAdapter();
    const info = adapter?.info;
    if (info?.description) return info.description;
  } catch {
    // WebGPU unavailable: fall back to WebGL.
  }
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    const raw = ext ? String(gl!.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : null;
    // "ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 (0x00002882) Direct3D11 vs_5_0 ps_5_0, D3D11)" -> "NVIDIA GeForce RTX 4060"
    const m = raw?.match(/ANGLE \([^,]+,\s*([^,(]+?)\s*(\(0x|Direct3D|OpenGL|,)/);
    return (m?.[1] ?? raw)?.trim() ?? null;
  } catch {
    return null;
  }
}

/** Exact VRAM from a connected ComfyUI (bytes -> GB), if any. */
async function comfyVram(s: Settings): Promise<{ gb: number; name: string } | null> {
  try {
    const res = await fetch(`${trimSlash(s.comfyUrl)}/system_stats`, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return null;
    const dev = (await res.json()).devices?.find((d: { type: string }) => d.type !== "cpu");
    return dev ? { gb: Math.round((dev.vram_total / 1024 ** 3) * 10) / 10, name: String(dev.name).replace(/^cuda:\d+\s*/, "").replace(/\s*:\s*cudaMallocAsync$/, "") } : null;
  } catch {
    return null;
  }
}

export async function detectHardware(s: Settings): Promise<Hardware> {
  const nav = navigator as Navigator & { deviceMemory?: number; userAgentData?: { mobile?: boolean } };
  const mobile = nav.userAgentData?.mobile ?? /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  const [name, comfy] = await Promise.all([gpuName(), comfyVram(s)]);
  const gpu = comfy?.name || name;
  const g = (gpu ?? "").toLowerCase();
  const vendor = /nvidia|geforce|rtx|gtx|quadro/.test(g) ? "nvidia" : /amd|radeon/.test(g) ? "amd" : /intel/.test(g) ? "intel" : /apple|m\d( pro| max| ultra)?\b/.test(g) ? "apple" : gpu ? "other" : null;
  // Integrated: Intel graphics, AMD "Radeon Graphics"/Vega without a model number, mobile chips.
  const integrated = vendor === "intel" || (vendor === "amd" && !/rx\s?\d{4}/.test(g)) || /adreno|mali|powervr/.test(g);
  let vramGb: number | null = comfy?.gb ?? null;
  if (vramGb === null && !integrated) {
    const table = vendor === "nvidia" ? NVIDIA_VRAM : vendor === "amd" ? AMD_VRAM : [];
    vramGb = table.find(([re]) => re.test(g))?.[1] ?? null;
  }
  return {
    gpu,
    vendor,
    integrated,
    vramGb,
    vramSource: comfy ? "comfyui" : vramGb !== null ? "estimate" : null,
    ramGb: nav.deviceMemory ?? null,
    cores: navigator.hardwareConcurrency ?? null,
    mobile,
  };
}

export function recommend(h: Hardware): Recommendation {
  const external = {
    analysis: "Gemini 2.5 Flash (tiene nivel gratis) o Claude",
    images: "Gemini Nano Banana, fal.ai o Replicate",
  };
  if (h.mobile) {
    return { verdict: "external", title: "Usa APIs externas", reasons: ["Estás en un teléfono o tablet: los modelos locales corren en un PC."], ...external };
  }
  if (h.vendor === "apple") {
    return {
      verdict: "mixed",
      title: "Analiza en tu Mac, genera en la nube",
      reasons: ["Un Mac con Apple Silicon corre bien un modelo de visión pequeño en Ollama.", "ComfyUI funciona, pero generar con SDXL o FLUX es lento sin GPU NVIDIA."],
      analysis: "Ollama con gemma3:4b o qwen2.5vl:7b",
      images: external.images,
    };
  }
  const v = h.vramGb;
  if (h.integrated || (v !== null && v < 6)) {
    return {
      verdict: "external",
      title: "Te conviene usar APIs externas",
      reasons: [h.integrated ? "Tu equipo usa gráficos integrados, sin memoria de video propia." : `Tu GPU tiene ${v} GB de VRAM; los modelos de imagen necesitan al menos 6–8 GB.`, "Gemini tiene nivel gratis para el análisis."],
      ...external,
    };
  }
  if (v === null) {
    return {
      verdict: "mixed",
      title: "No pudimos medir tu GPU",
      reasons: ["El navegador no dio el modelo de tu tarjeta. Si tienes una NVIDIA de 8 GB o más, todo local funciona; si no, usa APIs externas.", "Conecta ComfyUI para medir la VRAM exacta."],
      analysis: "Ollama si tienes GPU dedicada; si no, Gemini (gratis)",
      images: "ComfyUI si tienes 8 GB o más; si no, Gemini o fal.ai",
    };
  }
  if (v < 8) {
    return {
      verdict: "mixed",
      title: "Local con límites",
      reasons: [`${v} GB de VRAM alcanzan para SDXL, pero no para FLUX ni para un modelo de visión de 7B a buena velocidad.`],
      analysis: "Ollama con gemma3:4b, o Gemini (gratis) para mejores conceptos",
      images: "ComfyUI con SDXL",
    };
  }
  if (v < 12) {
    return {
      verdict: "local",
      title: "Puedes usar todo local",
      reasons: [`${v} GB de VRAM: SDXL y FLUX en GGUF Q4 funcionan, y qwen2.5vl:7b analiza en menos de un minuto.`, "Analiza y genera por turnos: los dos modelos no caben juntos en la GPU (Ollama se descarga solo después de cada análisis)."],
      analysis: "Ollama con qwen2.5vl:7b",
      images: "ComfyUI con SDXL o FLUX + Redux (Q4)",
    };
  }
  return {
    verdict: "local",
    title: "Tu equipo da para todo local",
    reasons: [`${v} GB de VRAM: FLUX con Redux y un modelo de visión de 7B sin problemas.`],
    analysis: "Ollama con qwen2.5vl:7b",
    images: "ComfyUI con FLUX + Redux",
  };
}
