// Visitor settings, kept only in this browser. API keys leave it only to reach their own provider (or /api/relay).
"use client";

export type Settings = {
  anthropicKey: string;
  openaiKey: string;
  geminiKey: string;
  falKey: string;
  replicateToken: string;
  ollamaUrl: string;
  ollamaModel: string;
  compatUrl: string;
  compatModel: string;
  comfyUrl: string;
  comfyWorkflow: "sdxl" | "flux";
  analysisLlm: string;
  imageProvider: string;
  imageModel: string;
  styleStrength: number;
};

export const DEFAULTS: Settings = {
  anthropicKey: "",
  openaiKey: "",
  geminiKey: "",
  falKey: "",
  replicateToken: "",
  ollamaUrl: "http://127.0.0.1:11434",
  ollamaModel: "qwen2.5vl:7b",
  compatUrl: "http://127.0.0.1:1234/v1",
  compatModel: "",
  comfyUrl: "http://127.0.0.1:8188",
  comfyWorkflow: "sdxl",
  analysisLlm: "gemini",
  imageProvider: "comfyui",
  imageModel: "",
  styleStrength: 0.25,
};

export const SECRET_KEYS = ["anthropicKey", "openaiKey", "geminiKey", "falKey", "replicateToken"] as const;

const STORAGE_KEY = "thumbstudio.settings";

export function loadSettings(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // Private mode or blocked storage: settings last for this visit only.
  }
}

export function clearKeys(s: Settings): Settings {
  const next = { ...s };
  for (const k of SECRET_KEYS) next[k] = "";
  saveSettings(next);
  return next;
}

export const trimSlash = (url: string) => url.replace(/\/+$/, "");
