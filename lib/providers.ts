// Image generators, called from the visitor's browser with the visitor's own models or keys.
// Port of th-yt-mcp/providers/*.
"use client";

import { LocalUnreachable } from "./analysis";
import { blobToBase64 } from "./image";
import { type Settings, trimSlash } from "./settings";

export type GenerateArgs = {
  prompt: string;
  n: number;
  model: string;
  contentImages: Blob[];
  styleImages: Blob[];
  styleStrength: number;
};

export type Provider = {
  id: string;
  label: string;
  sub: string; // one line under the name in the provider list
  local: boolean;
  models: (s: Settings) => string[];
  styleRefs: string; // how style references are used, shown in the UI
  ready: (s: Settings) => boolean;
  needs: string; // what is missing when not ready
  generate: (s: Settings, a: GenerateArgs) => Promise<Blob[]>;
};

// Appended to the prompt by providers that take style references as plain images,
// so the model borrows the look of the popular thumbnails and not their subject.
const STYLE_RULE = (n: number) =>
  `The ${n} reference image(s) labelled STYLE are popular YouTube thumbnails from the same channel. ` +
  "Copy only their visual style: composition, framing, facial expression intensity, color palette, contrast, " +
  "lighting and background treatment. Do NOT copy their subject, objects, people, logos or text.";
const CONTENT_RULE = "The image(s) labelled CONTENT show the real subject (person, product or scene) to feature; keep it recognizable.";

function withRules(prompt: string, content: Blob[], style: Blob[]) {
  const parts = [prompt, "16:9 YouTube thumbnail composition, bold, high contrast, readable at small sizes."];
  if (content.length) parts.push(CONTENT_RULE);
  if (style.length) parts.push(STYLE_RULE(style.length));
  return parts.join("\n\n");
}

const dataUri = async (b: Blob) => `data:${b.type || "image/png"};base64,${await blobToBase64(b)}`;
const b64ToBlob = (b64: string, type = "image/png") => new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], { type });

async function fetchBlob(url: string, viaRelay = false) {
  const res = await fetch(viaRelay ? `/api/relay?url=${encodeURIComponent(url)}` : url);
  if (!res.ok) throw new Error(`No pudimos descargar la imagen (${res.status})`);
  return res.blob();
}

// ---------------------------------------------------------------- ComfyUI (local)

const NEGATIVE =
  "text, letters, words, watermark, logo, signature, caption, blurry, lowres, jpeg artifacts, " +
  "deformed, bad anatomy, extra fingers, cropped face, dull colors";
const seed = () => Math.floor(Math.random() * 2 ** 48);

async function comfy(s: Settings, path: string, init?: RequestInit) {
  let res: Response;
  try {
    res = await fetch(`${trimSlash(s.comfyUrl)}${path}`, init);
  } catch {
    throw new LocalUnreachable("comfyui");
  }
  if (!res.ok) throw new Error(`ComfyUI ${res.status}: ${(await res.text()).slice(0, 400)}`);
  return res;
}

async function comfyChoices(s: Settings, node: string, field: string): Promise<string[] | null> {
  const info = await (await comfy(s, `/object_info/${node}`)).json();
  return info[node]?.input?.required?.[field]?.[0] ?? null;
}

async function comfyUpload(s: Settings, blob: Blob, name: string) {
  const form = new FormData();
  form.append("image", blob, name);
  form.append("overwrite", "true");
  return (await (await comfy(s, "/upload/image", { method: "POST", body: form })).json()).name as string;
}

type Workflow = Record<string, { class_type: string; inputs: Record<string, unknown> }>;

async function sdxlWorkflow(s: Settings, prompt: string, batch: number, init: Blob | undefined, strength: number): Promise<Workflow> {
  const ckpts = await comfyChoices(s, "CheckpointLoaderSimple", "ckpt_name");
  if (!ckpts?.length) throw new Error("Tu ComfyUI no tiene checkpoints en models/checkpoints.");
  const ckpt = ckpts.find((n) => n.toLowerCase().includes("juggernaut")) ?? ckpts.find((n) => /xl/i.test(n)) ?? ckpts[0];
  const wf: Workflow = {
    ckpt: { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: ckpt } },
    pos: { class_type: "CLIPTextEncode", inputs: { clip: ["ckpt", 1], text: prompt } },
    neg: { class_type: "CLIPTextEncode", inputs: { clip: ["ckpt", 1], text: NEGATIVE } },
    // 1344x768 is the SDXL training bucket closest to 16:9.
    latent: { class_type: "EmptyLatentImage", inputs: { width: 1344, height: 768, batch_size: batch } },
    sample: { class_type: "KSampler", inputs: {
      model: ["ckpt", 0], positive: ["pos", 0], negative: ["neg", 0], latent_image: ["latent", 0],
      seed: seed(), steps: 30, cfg: 4.5, sampler_name: "dpmpp_2m_sde", scheduler: "karras", denoise: 1.0,
    } },
    decode: { class_type: "VAEDecode", inputs: { samples: ["sample", 0], vae: ["ckpt", 2] } },
    save: { class_type: "SaveImage", inputs: { images: ["decode", 0], filename_prefix: "thumbstudio" } },
  };
  if (init) {
    // img2img: start from the visitor's frame instead of noise.
    wf.load = { class_type: "LoadImage", inputs: { image: await comfyUpload(s, init, "content.png") } };
    wf.scale = { class_type: "ImageScale", inputs: { image: ["load", 0], upscale_method: "lanczos", width: 1344, height: 768, crop: "center" } };
    wf.encode = { class_type: "VAEEncode", inputs: { pixels: ["scale", 0], vae: ["ckpt", 2] } };
    wf.batch = { class_type: "RepeatLatentBatch", inputs: { samples: ["encode", 0], amount: batch } };
    Object.assign(wf.sample.inputs, { latent_image: ["batch", 0], denoise: strength });
    delete wf.latent;
  }
  return wf;
}

async function fluxWorkflow(s: Settings, prompt: string, batch: number, init: Blob | undefined, style: Blob[], styleStrength: number): Promise<Workflow> {
  const kontext = !!init;
  const unets = await comfyChoices(s, "UnetLoaderGGUF", "unet_name");
  if (!unets) throw new Error("Tu ComfyUI no tiene el nodo ComfyUI-GGUF. Instálalo desde el Manager y reinicia ComfyUI.");
  const unet = unets.find((n) => /flux/i.test(n) && /kontext/i.test(n) === kontext);
  if (!unet) throw new Error(`Falta ${kontext ? "flux1-kontext-dev-*.gguf" : "flux1-dev-*.gguf"} en models/diffusion_models.`);
  const t5s = (await comfyChoices(s, "DualCLIPLoader", "clip_name1")) ?? [];
  const wf: Workflow = {
    unet: { class_type: "UnetLoaderGGUF", inputs: { unet_name: unet } },
    clip: { class_type: "DualCLIPLoader", inputs: {
      clip_name1: t5s.find((n) => /t5xxl/i.test(n)) ?? "t5xxl_fp8_e4m3fn_scaled.safetensors",
      clip_name2: "clip_l.safetensors", type: "flux",
    } },
    vae: { class_type: "VAELoader", inputs: { vae_name: "ae.safetensors" } },
    pos: { class_type: "CLIPTextEncode", inputs: { clip: ["clip", 0], text: prompt } },
    guide: { class_type: "FluxGuidance", inputs: { conditioning: ["pos", 0], guidance: 3.5 } },
    // Flux runs at cfg 1, so the negative is ignored, but KSampler still needs one.
    neg: { class_type: "ConditioningZeroOut", inputs: { conditioning: ["pos", 0] } },
    latent: { class_type: "EmptySD3LatentImage", inputs: { width: 1280, height: 720, batch_size: batch } },
    sample: { class_type: "KSampler", inputs: {
      model: ["unet", 0], positive: ["guide", 0], negative: ["neg", 0], latent_image: ["latent", 0],
      seed: seed(), steps: 24, cfg: 1.0, sampler_name: "euler", scheduler: "simple", denoise: 1.0,
    } },
    decode: { class_type: "VAEDecode", inputs: { samples: ["sample", 0], vae: ["vae", 0] } },
    save: { class_type: "SaveImage", inputs: { images: ["decode", 0], filename_prefix: "thumbstudio" } },
  };
  let cond: unknown[] = ["pos", 0];
  if (init) {
    // Kontext edits the frame by instruction instead of re-noising it, so faces and HUDs survive.
    wf.load = { class_type: "LoadImage", inputs: { image: await comfyUpload(s, init, "content.png") } };
    wf.scale = { class_type: "FluxKontextImageScale", inputs: { image: ["load", 0] } };
    wf.encode = { class_type: "VAEEncode", inputs: { pixels: ["scale", 0], vae: ["vae", 0] } };
    wf.ref = { class_type: "ReferenceLatent", inputs: { conditioning: cond, latent: ["encode", 0] } };
    cond = ["ref", 0];
    wf.guide.inputs.guidance = 2.5;
    wf.batch = { class_type: "RepeatLatentBatch", inputs: { samples: ["encode", 0], amount: batch } };
    wf.sample.inputs.latent_image = ["batch", 0];
    delete wf.latent;
  }
  if (style.length) {
    // Redux: each popular thumbnail nudges the look. A low strength keeps their subject out of the result.
    const vision = (await comfyChoices(s, "CLIPVisionLoader", "clip_name"))?.find((n) => /sigclip/i.test(n));
    const redux = (await comfyChoices(s, "StyleModelLoader", "style_model_name"))?.find((n) => /redux/i.test(n));
    if (!vision) throw new Error("Las referencias de estilo necesitan sigclip_vision_patch14_384.safetensors en models/clip_vision/.");
    if (!redux) throw new Error("Las referencias de estilo necesitan flux1-redux-dev.safetensors en models/style_models/.");
    wf.vision = { class_type: "CLIPVisionLoader", inputs: { clip_name: vision } };
    wf.redux = { class_type: "StyleModelLoader", inputs: { style_model_name: redux } };
    const perImage = styleStrength / Math.sqrt(style.length);
    for (const [i, img] of style.entries()) {
      wf[`style_load${i}`] = { class_type: "LoadImage", inputs: { image: await comfyUpload(s, img, `style-${i}.jpg`) } };
      wf[`style_enc${i}`] = { class_type: "CLIPVisionEncode", inputs: { clip_vision: ["vision", 0], image: [`style_load${i}`, 0], crop: "center" } };
      wf[`style${i}`] = { class_type: "StyleModelApply", inputs: {
        conditioning: cond, style_model: ["redux", 0], clip_vision_output: [`style_enc${i}`, 0], strength: perImage, strength_type: "multiply",
      } };
      cond = [`style${i}`, 0];
    }
  }
  wf.guide.inputs.conditioning = cond;
  return wf;
}

const comfyui: Provider = {
  id: "comfyui",
  label: "ComfyUI",
  sub: "En tu PC",
  local: true,
  models: () => ["sdxl", "flux"],
  styleRefs: "solo flux, con FLUX.1 Redux",
  ready: () => true,
  needs: "ComfyUI abierto y con CORS activado",
  async generate(s, a) {
    const flux = (a.model || s.comfyWorkflow) === "flux";
    const init = a.contentImages[0];
    let wf: Workflow;
    if (flux) {
      // No "youtube thumbnail" here: Flux can write, and that phrase makes it invent captions.
      const prompt = init ? a.prompt : `${a.prompt}, dramatic lighting, vibrant saturated colors, high contrast, sharp focus`;
      wf = await fluxWorkflow(s, prompt, a.n, init, a.styleImages, a.styleStrength);
    } else {
      // SDXL can't take style images; the style reaches it through the analysis-written prompt.
      wf = await sdxlWorkflow(s, `${a.prompt}, youtube thumbnail, dramatic lighting, vibrant saturated colors, high contrast, sharp focus`, a.n, init, 0.6);
    }
    const queued = await (await comfy(s, "/prompt", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: wf, client_id: crypto.randomUUID() }),
    })).json();
    const id = queued.prompt_id as string;
    const deadline = Date.now() + 15 * 60 * 1000;
    while (Date.now() < deadline) {
      const history = (await (await comfy(s, `/history/${id}`)).json())[id];
      if (history) {
        if (history.status?.status_str === "error") throw new Error(`ComfyUI falló: ${JSON.stringify(history.status.messages).slice(0, 400)}`);
        const images = history.outputs?.save?.images as { filename: string; subfolder: string; type: string }[] | undefined;
        if (images?.length) {
          return Promise.all(images.map(async (i) =>
            (await comfy(s, `/view?${new URLSearchParams({ filename: i.filename, subfolder: i.subfolder, type: i.type })}`)).blob()));
        }
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error("ComfyUI no terminó en 15 minutos.");
  },
};

// ---------------------------------------------------------------- External APIs (visitor's keys)

const openai: Provider = {
  id: "openai",
  label: "OpenAI",
  sub: "gpt-image",
  local: false,
  models: () => ["gpt-image-2", "gpt-image-1"],
  styleRefs: "sí",
  ready: (s) => !!s.openaiKey,
  needs: "tu API key de OpenAI",
  async generate(s, a) {
    const { default: OpenAI, toFile } = await import("openai");
    const client = new OpenAI({ apiKey: s.openaiKey, dangerouslyAllowBrowser: true });
    // The API renders 1536x1024; cropping to 16:9 removes the top and bottom, so keep the subject centered.
    let prompt = withRules(a.prompt, a.contentImages, a.styleImages) +
      "\nKeep all text and faces inside the central horizontal band; the top and bottom ~8% will be cropped.";
    if (a.contentImages.length && a.styleImages.length) prompt += `\nImages 1-${a.contentImages.length} are CONTENT, the rest are STYLE.`;
    else if (a.styleImages.length) prompt += "\nAll images are STYLE.";
    const params = { model: a.model || "gpt-image-2", prompt, size: "1536x1024" as const, n: a.n, quality: "high" as const };
    const refs = [...a.contentImages, ...a.styleImages];
    const res = refs.length
      ? await client.images.edit({ ...params, image: await Promise.all(refs.map((b, i) => toFile(b, `ref-${i}.png`, { type: b.type || "image/png" }))) })
      : await client.images.generate(params);
    return (res.data ?? []).map((d) => b64ToBlob(d.b64_json!));
  },
};

const gemini: Provider = {
  id: "gemini",
  label: "Gemini",
  sub: "Nano Banana",
  local: false,
  models: () => ["gemini-2.5-flash-image", "gemini-3-pro-image-preview"],
  styleRefs: "sí",
  ready: (s) => !!s.geminiKey,
  needs: "tu API key de Gemini",
  async generate(s, a) {
    const { GoogleGenAI } = await import("@google/genai");
    const client = new GoogleGenAI({ apiKey: s.geminiKey });
    const parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] = [{ text: withRules(a.prompt, a.contentImages, a.styleImages) }];
    for (const [label, blobs] of [["CONTENT", a.contentImages], ["STYLE", a.styleImages]] as const) {
      for (const [i, b] of blobs.entries()) {
        parts.push({ text: `${label} reference ${i + 1}:` }, { inlineData: { mimeType: b.type || "image/png", data: await blobToBase64(b) } });
      }
    }
    const out: Blob[] = [];
    // One image per call: the API has no batch size for image output.
    for (let i = 0; i < a.n; i++) {
      const res = await client.models.generateContent({
        model: a.model || "gemini-2.5-flash-image",
        contents: [{ role: "user", parts }],
        config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "16:9" } },
      });
      for (const p of res.candidates?.[0]?.content?.parts ?? []) {
        if (p.inlineData?.data) out.push(b64ToBlob(p.inlineData.data, p.inlineData.mimeType));
      }
    }
    if (!out.length) throw new Error("Gemini no devolvió imagen (quizá bloqueó el prompt). Prueba reformularlo.");
    return out;
  },
};

const FAL_MODELS = [
  "fal-ai/nano-banana/edit",
  "fal-ai/flux-pro/kontext/max/multi",
  "fal-ai/flux-pro/v1.1-ultra/redux",
  "fal-ai/flux-pro/v1.1-ultra",
  "fal-ai/ideogram/v3",
  "fal-ai/recraft-v3",
];

const fal: Provider = {
  id: "fal",
  label: "fal.ai",
  sub: "FLUX, Ideogram…",
  local: false,
  models: () => FAL_MODELS,
  styleRefs: "sí (según el modelo)",
  ready: (s) => !!s.falKey,
  needs: "tu API key de fal.ai",
  async generate(s, a) {
    const { createFalClient } = await import("@fal-ai/client");
    const client = createFalClient({ credentials: s.falKey });
    const refs = [...a.contentImages, ...a.styleImages];
    const model = a.model || (refs.length ? "fal-ai/nano-banana/edit" : "fal-ai/flux-pro/v1.1-ultra");
    const needsRefs = model.endsWith("/redux") || model.endsWith("/edit") || model.includes("kontext");
    if (needsRefs && !refs.length) throw new Error(`${model} necesita al menos una imagen de referencia.`);
    const prompt = withRules(a.prompt, a.contentImages, a.styleImages);
    const uris = await Promise.all(refs.map(dataUri));
    // Each fal model names its inputs differently.
    let input: Record<string, unknown>;
    if (model.endsWith("/redux")) {
      // Redux takes one image whose look it carries over; image_prompt_strength is how much.
      input = { prompt, image_url: uris.at(-1), image_prompt_strength: a.styleStrength, aspect_ratio: "16:9", num_images: a.n };
    } else if (model.includes("kontext")) {
      input = { prompt, image_urls: uris, aspect_ratio: "16:9", num_images: a.n };
    } else if (model.endsWith("/edit")) {
      input = { prompt, image_urls: uris, num_images: a.n };
    } else if (model.includes("ideogram")) {
      input = { prompt, image_size: "landscape_16_9", num_images: a.n };
      if (a.styleImages.length) input.image_urls = await Promise.all(a.styleImages.map(dataUri));
    } else if (model.includes("recraft")) {
      input = { prompt, image_size: "landscape_16_9" };
    } else {
      input = { prompt, aspect_ratio: "16:9", num_images: a.n };
    }
    const result = await client.subscribe(model, { input });
    const images = ((result.data as { images?: { url: string }[] }).images ?? []);
    return Promise.all(images.map((i) => fetchBlob(i.url)));
  },
};

const REPLICATE_MODELS = [
  "google/nano-banana",
  "black-forest-labs/flux-1.1-pro-ultra",
  "black-forest-labs/flux-kontext-pro",
  "ideogram-ai/ideogram-v3-turbo",
];

async function replicateApi(s: Settings, url: string, body?: unknown) {
  // Replicate doesn't allow browser calls (no CORS), so this goes through /api/relay, which never stores the token.
  const res = await fetch(`/api/relay?url=${encodeURIComponent(url)}`, {
    method: body ? "POST" : "GET",
    headers: { "x-provider-auth": `Bearer ${s.replicateToken}`, "content-type": "application/json", prefer: "wait=60" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Replicate ${res.status}: ${data.detail ?? data.error ?? JSON.stringify(data).slice(0, 300)}`);
  return data;
}

const replicate: Provider = {
  id: "replicate",
  label: "Replicate",
  sub: "FLUX, Nano Banana",
  local: false,
  models: () => REPLICATE_MODELS,
  styleRefs: "sí (según el modelo)",
  ready: (s) => !!s.replicateToken,
  needs: "tu API token de Replicate",
  async generate(s, a) {
    const model = a.model || REPLICATE_MODELS[0];
    const prompt = withRules(a.prompt, a.contentImages, a.styleImages);
    const refs = [...a.contentImages, ...a.styleImages];
    // Each model names its image inputs differently; data URIs work for all of them.
    let input: Record<string, unknown>;
    if (model.includes("nano-banana")) {
      input = { prompt, image_input: await Promise.all(refs.map(dataUri)), output_format: "png" };
    } else if (model.includes("kontext")) {
      if (!refs.length) throw new Error(`${model} necesita una imagen de referencia.`);
      input = { prompt, input_image: await dataUri(refs[0]), aspect_ratio: "16:9", output_format: "png" };
    } else if (model.includes("ideogram")) {
      input = { prompt, aspect_ratio: "16:9" };
      if (a.styleImages.length) input.style_reference_images = await Promise.all(a.styleImages.map(dataUri));
    } else {
      input = { prompt, aspect_ratio: "16:9", output_format: "png" };
      if (a.styleImages.length) Object.assign(input, { image_prompt: await dataUri(a.styleImages[0]), image_prompt_strength: a.styleStrength });
    }
    const out: Blob[] = [];
    // Most Replicate image models return one image per run.
    for (let i = 0; i < a.n; i++) {
      let p = await replicateApi(s, `https://api.replicate.com/v1/models/${model}/predictions`, { input });
      while (p.status === "starting" || p.status === "processing") {
        await new Promise((r) => setTimeout(r, 1500));
        p = await replicateApi(s, p.urls.get);
      }
      if (p.status !== "succeeded") throw new Error(`Replicate: ${p.error ?? p.status}`);
      for (const url of Array.isArray(p.output) ? p.output : [p.output]) out.push(await fetchBlob(url, true));
    }
    return out;
  },
};

export const PROVIDERS: Provider[] = [comfyui, gemini, openai, fal, replicate];
export const provider = (id: string) => PROVIDERS.find((p) => p.id === id) ?? comfyui;
