// Style analysis in the browser: a vision LLM studies the channel's top thumbnails and proposes concepts for the
// visitor's video that borrow their style, not their ideas. Port of th-yt-mcp/analysis.py.
"use client";

import type { StyleProfile } from "./image";
import { type Settings, trimSlash } from "./settings";
import type { Video } from "./types";

export const SYSTEM = `You are a YouTube thumbnail art director.
You get a numbered contact sheet of a channel's most viewed thumbnails (with views), an objective style profile
(palette, brightness, saturation, which side is calmer) and the context of the user's NEW video.

Rule: borrow the STYLE of the winners - framing and subject size, facial expression and its intensity, number of
elements, palette, contrast, lighting, background treatment, and how text is used (word count, position, highlight
color). Never reuse their topics, objects, people, logos, catchphrases or title text. Every concept must come from
the user's video.

Write image_prompt in English as a description of the image only (subject, expression, setting, lighting, colors,
composition), leaving the text side mostly empty, with no text in the image. text is the thumbnail title in the
language of the user's video, 2-5 words, using \\n for a line break. Reply with JSON only.`;

const PATTERN_KEYS = ["framing", "faces", "elements", "palette", "contrast", "background", "text"] as const;

export const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["style_patterns", "avoid", "concepts"],
  properties: {
    style_patterns: {
      type: "object",
      additionalProperties: false,
      required: [...PATTERN_KEYS],
      properties: Object.fromEntries(PATTERN_KEYS.map((k) => [k, { type: "string" }])),
    },
    avoid: { type: "array", items: { type: "string" } },
    concepts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["idea", "image_prompt", "text", "position", "highlight_word", "text_color", "highlight_color",
          "best_reference_numbers", "why_it_matches_style"],
        properties: {
          idea: { type: "string" },
          image_prompt: { type: "string" },
          text: { type: "string" },
          position: { type: "string", enum: ["left", "right", "top", "bottom", "center"] },
          highlight_word: { type: "string" },
          text_color: { type: "string" },
          highlight_color: { type: "string" },
          best_reference_numbers: { type: "array", items: { type: "integer" } },
          why_it_matches_style: { type: "string" },
        },
      },
    },
  },
};

export type Concept = {
  idea: string;
  image_prompt: string;
  text: string;
  position: "left" | "right" | "top" | "bottom" | "center";
  highlight_word: string;
  text_color: string;
  highlight_color: string;
  best_reference_numbers: number[];
  why_it_matches_style: string;
};

export type Analysis = {
  style_patterns: Record<(typeof PATTERN_KEYS)[number], string>;
  avoid: string[];
  concepts: Concept[];
  /** Added by the studio, not the model: which LLM ran and how long it took. */
  meta?: { llm: LlmId; seconds: number };
};

/** SCHEMA with hard limits. Small local models drift without them; Ollama enforces these as a grammar. */
export function localSchema(nConcepts: number) {
  const schema = structuredClone(SCHEMA) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  Object.assign(schema.properties.avoid, { minItems: 1, maxItems: 8 });
  const concepts = schema.properties.concepts;
  Object.assign(concepts, { minItems: nConcepts, maxItems: nConcepts });
  // No maxLength on text: a grammar limit cuts words in half. clean() trims long titles instead.
  Object.assign(concepts.items.properties.best_reference_numbers, { minItems: 1, maxItems: 4 });
  return schema;
}

/** Rough guess so the prompt can name the title language; small models ignore "same language as". */
export function videoLanguage(text: string) {
  if (/[ñ¿¡]|\b(el|la|los|las|que|de|para|con|una?|por|qué|cómo)\b/i.test(text)) return "Spanish";
  if (/[ãõç]|\b(não|você|uma|para|com|que)\b/i.test(text)) return "Portuguese";
  return null;
}

export function userText(refs: Video[], profile: StyleProfile | null, myVideo: string, nConcepts: number) {
  const list = refs.map((v, i) => `${i + 1}. ${v.views.toLocaleString("en-US")} views - ${v.title}`).join("\n");
  const lang = videoLanguage(myVideo);
  return (
    `Top thumbnails (numbers match the sheet):\n${list}\n\n` +
    `Style profile: ${JSON.stringify(profile)}\n\n` +
    `My new video:\n${myVideo}\n\n` +
    `style_patterns: what the REFERENCE thumbnails on the sheet have in common, not my video. ` +
    `avoid: the concrete topics, products and people seen in the references. ` +
    `Give ${nConcepts} distinct concepts, best first. ` +
    `text: 2-5 words, in ${lang ?? "the same language as 'My new video'"}; idea also in ${lang ?? "that language"}. ` +
    `image_prompt: always in English. ` +
    `highlight_word: one word copied from text. text_color and highlight_color: hex colors like #FFFFFF. ` +
    `best_reference_numbers: the 2-4 sheet numbers whose style fits each concept.`
  );
}

const HEX = /^#[0-9a-f]{6}$/i;

/** Relative luminance 0..1 of #RRGGBB (sRGB weights, no gamma: enough to tell dark from light). */
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Make model output safe to render: short titles, a highlight word that exists, valid colors. */
export function clean(c: Concept): Concept {
  const words = c.text.replace(/\\n/g, "\n").split(/\s+/).filter(Boolean);
  // Titles past 6 words don't read at feed size; keep a line break near the middle.
  const kept = words.slice(0, 6);
  const text = kept.length > 3 ? `${kept.slice(0, Math.ceil(kept.length / 2)).join(" ")}\n${kept.slice(Math.ceil(kept.length / 2)).join(" ")}` : kept.join(" ");
  const bare = (w: string) => w.replace(/[.,!?¡¿:;"]/g, "").toUpperCase();
  const hl = kept.find((w) => bare(w) === bare(c.highlight_word ?? "")) ?? [...kept].sort((a, b) => bare(b).length - bare(a).length)[0] ?? "";
  return {
    ...c,
    text,
    highlight_word: bare(hl),
    // Dark title colors vanish on dark thumbnails; the outline only helps light ones.
    text_color: HEX.test(c.text_color) && luminance(c.text_color) > 0.45 ? c.text_color : "#FFFFFF",
    highlight_color: HEX.test(c.highlight_color) && c.highlight_color.toUpperCase() !== c.text_color?.toUpperCase() ? c.highlight_color : "#FFD400",
    position: (["left", "right", "top", "bottom", "center"] as const).includes(c.position) ? c.position : "left",
    best_reference_numbers: (c.best_reference_numbers ?? []).filter((n) => Number.isInteger(n)),
  };
}

type Call = (s: Settings, model: string, sheetB64: string, text: string, nConcepts: number) => Promise<string>;

const anthropic: Call = async (s, model, sheetB64, text) => {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: s.anthropicKey, dangerouslyAllowBrowser: true });
  const response = await client.beta.messages.create({
    model,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: sheetB64 } },
        { type: "text", text },
      ],
    }],
  });
  if (response.stop_reason === "refusal") throw new Error("Claude no quiso analizar estas miniaturas. Prueba con otras referencias.");
  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("Claude no devolvió texto");
  return block.text;
};

async function openaiCompatible(apiKey: string, baseURL: string | undefined, model: string, sheetB64: string, text: string) {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: apiKey || "local", baseURL, dangerouslyAllowBrowser: true });
  const response = await client.chat.completions.create({
    model,
    response_format: { type: "json_schema", json_schema: { name: "thumbnail_brief", schema: SCHEMA, strict: true } },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: [
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${sheetB64}` } },
        { type: "text", text },
      ] },
    ],
  });
  return response.choices[0]?.message?.content ?? "";
}

const openai: Call = (s, model, sheetB64, text) => openaiCompatible(s.openaiKey, undefined, model, sheetB64, text);

const compat: Call = (s, model, sheetB64, text) => {
  if (!model) throw new Error("Escribe el nombre del modelo local en Ajustes (por ejemplo qwen2.5-vl-7b-instruct).");
  return openaiCompatible("", trimSlash(s.compatUrl), model, sheetB64, text);
};

const gemini: Call = async (s, model, sheetB64, text) => {
  const { GoogleGenAI } = await import("@google/genai");
  const client = new GoogleGenAI({ apiKey: s.geminiKey });
  const response = await client.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ inlineData: { mimeType: "image/jpeg", data: sheetB64 } }, { text }] }],
    config: { systemInstruction: SYSTEM, responseMimeType: "application/json", responseJsonSchema: SCHEMA },
  });
  return response.text ?? "";
};

const ollama: Call = async (s, model, sheetB64, text, nConcepts) => {
  let res: Response;
  try {
    res = await fetch(`${trimSlash(s.ollamaUrl)}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        format: localSchema(nConcepts),
        // Unload right after, so ComfyUI gets the VRAM back for generation.
        keep_alive: 0,
        options: { temperature: 0.7, num_ctx: 8192 },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: text, images: [sheetB64] },
        ],
      }),
    });
  } catch {
    throw new LocalUnreachable("ollama");
  }
  if (res.status === 404) throw new Error(`Ollama no tiene '${model}'. Ejecuta: ollama pull ${model}`);
  if (!res.ok) throw new Error(`Ollama error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()).message.content;
};

/** A local service didn't answer: not running, or it blocks this site (CORS). The UI shows the setup help. */
export class LocalUnreachable extends Error {
  constructor(public service: "ollama" | "comfyui" | "compat") {
    super(`No pudimos conectar con ${service}. ¿Está abierto y permite este sitio (CORS)?`);
  }
}

export type LlmId = "gemini" | "anthropic" | "openai" | "ollama" | "compat";

export const LLMS: Record<LlmId, { label: string; sub: string; local: boolean; defaultModel: (s: Settings) => string; ready: (s: Settings) => boolean; call: Call }> = {
  gemini: { label: "Gemini 2.5 Flash", sub: "Nube · tiene nivel gratis", local: false, defaultModel: () => "gemini-2.5-flash", ready: (s) => !!s.geminiKey, call: gemini },
  anthropic: { label: "Claude Opus 5.5", sub: "Nube · el análisis más fiel", local: false, defaultModel: () => "claude-opus-5-5", ready: (s) => !!s.anthropicKey, call: anthropic },
  openai: { label: "OpenAI GPT-5", sub: "Nube · con tu key", local: false, defaultModel: () => "gpt-5", ready: (s) => !!s.openaiKey, call: openai },
  ollama: { label: "Ollama", sub: "En tu PC · gratis", local: true, defaultModel: (s) => s.ollamaModel, ready: () => true, call: ollama },
  compat: { label: "LM Studio", sub: "En tu PC · compatible con OpenAI", local: true, defaultModel: (s) => s.compatModel, ready: () => true, call: compat },
};

export async function analyze(
  s: Settings, llm: LlmId, sheetB64: string, refs: Video[], profile: StyleProfile | null, myVideo: string, nConcepts = 3,
): Promise<Analysis> {
  const spec = LLMS[llm];
  let raw = await spec.call(s, spec.defaultModel(s), sheetB64, userText(refs, profile, myVideo, nConcepts), nConcepts);
  // Some models wrap JSON in a code fence even when asked not to.
  raw = raw.trim().replace(/^```(?:json)?/, "").replace(/```$/, "");
  let result: Analysis;
  try {
    result = JSON.parse(raw);
  } catch {
    throw new Error("El modelo no devolvió un JSON válido. Vuelve a analizar o prueba otro modelo.");
  }
  result.concepts = (result.concepts ?? []).slice(0, nConcepts).map(clean);
  return result;
}

/** Ping a local service with a short timeout. */
export async function ping(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    return res.ok;
  } catch {
    return false;
  }
}
