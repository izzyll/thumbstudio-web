// Canvas image work in the browser. Port of th-yt-mcp/thumbnails.py (contact_sheet, style_profile, add_text,
// compare_sheet, preview). Everything stays on the visitor's machine.
"use client";

export const W = 1280;
export const H = 720;
// Sizes a thumbnail is actually seen at: home feed (desktop), suggested sidebar, mobile search.
export const PREVIEW_SIZES: [number, number][] = [[360, 202], [246, 138], [168, 94]];

export const thumbUrl = (videoId: string) => `/api/thumb/${videoId}`;

export async function loadImage(src: string | Blob): Promise<ImageBitmap> {
  const blob = typeof src === "string" ? await (await fetch(src)).blob() : src;
  return createImageBitmap(blob);
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
}

/** Draw `img` center-cropped to fill (x, y, w, h). */
function drawCover(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

export const toBlob = (c: HTMLCanvasElement, type = "image/png") =>
  new Promise<Blob>((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error("canvas export failed"))), type, 0.92));

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Any image -> 1280x720 PNG blob. */
export async function to16x9(src: Blob | ImageBitmap): Promise<Blob> {
  const img = src instanceof Blob ? await loadImage(src) : src;
  const [c, ctx] = canvas(W, H);
  drawCover(ctx, img, 0, 0, W, H);
  return toBlob(c);
}

/** Grid of thumbnails with a numbered label under each, so many fit in one image for a vision LLM. */
export async function contactSheet(images: ImageBitmap[], labels: string[], cols = 2): Promise<Blob> {
  const tw = 640, th = 360, labelH = 28;
  const rows = Math.ceil(images.length / cols);
  const [c, ctx] = canvas(cols * tw, rows * (th + labelH));
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.font = "bold 18px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  images.forEach((img, i) => {
    const x = (i % cols) * tw;
    const y = Math.floor(i / cols) * (th + labelH);
    drawCover(ctx, img, x, y, tw, th);
    ctx.fillStyle = "#000";
    ctx.fillText(`${i + 1}. ${labels[i] ?? ""}`.slice(0, 70), x + 8, y + th + labelH / 2);
  });
  return toBlob(c, "image/jpeg");
}

export type StyleProfile = {
  palette: { hex: string; share: number }[];
  avgBrightness: number;
  avgSaturation: number;
  calmerSideCounts: { left: number; right: number };
};

const hex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();

/** Objective look of a set of thumbnails: shared palette, brightness, saturation and where they leave space. */
export function styleProfile(images: ImageBitmap[]): StyleProfile | null {
  if (!images.length) return null;
  const sw = 64, sh = 36;
  const [, ctx] = canvas(sw, sh);
  const pixels: [number, number, number][] = [];
  let sat = 0, val = 0;
  const sides = { left: 0, right: 0 };
  for (const img of images) {
    drawCover(ctx, img, 0, 0, sw, sh);
    const d = ctx.getImageData(0, 0, sw, sh).data;
    const half = [[0, 0, 0], [0, 0, 0]]; // per half: sum, sum of squares, count of luma
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      pixels.push([r, g, b]);
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      val += mx / 255;
      sat += mx ? (mx - mn) / mx : 0;
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      const h = ((i / 4) % sw) < sw / 2 ? half[0] : half[1];
      h[0] += luma; h[1] += luma * luma; h[2] += 1;
    }
    // Busy halves have high pixel variance; the calmer half is where titles usually sit.
    const sd = (h: number[]) => Math.sqrt(h[1] / h[2] - (h[0] / h[2]) ** 2);
    sides[sd(half[0]) < sd(half[1]) ? "left" : "right"] += 1;
  }

  // k-means (k=6) on the shared pixels, seeded evenly across them.
  const k = 6;
  let centers = Array.from({ length: k }, (_, i) => [...pixels[Math.floor(((i + 0.5) * pixels.length) / k)]]);
  const assign = new Uint8Array(pixels.length);
  for (let iter = 0; iter < 10; iter++) {
    const sums = Array.from({ length: k }, () => [0, 0, 0, 0]);
    pixels.forEach((p, i) => {
      let best = 0, bestD = Infinity;
      centers.forEach((c, j) => {
        const dd = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
        if (dd < bestD) { bestD = dd; best = j; }
      });
      assign[i] = best;
      const s = sums[best];
      s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3] += 1;
    });
    centers = sums.map((s, j) => (s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : centers[j]));
  }
  const counts = new Array(k).fill(0);
  assign.forEach((a) => counts[a]++);
  const palette = centers
    .map((c, j) => ({ hex: hex(c[0], c[1], c[2]), share: Math.round((counts[j] / pixels.length) * 100) / 100 }))
    .filter((p) => p.share > 0)
    .sort((a, b) => b.share - a.share);

  const n = pixels.length;
  return {
    palette,
    avgBrightness: Math.round((val / n) * 100) / 100,
    avgSaturation: Math.round((sat / n) * 100) / 100,
    calmerSideCounts: sides,
  };
}

export type TextPosition = "left" | "right" | "top" | "bottom" | "center";

export type TextOptions = {
  text: string;
  position?: TextPosition;
  color?: string;
  strokeColor?: string;
  highlightWord?: string;
  highlightColor?: string;
  fontFamily: string;
};

/** Big outlined title, auto-sized to its area, with one highlighted word. Use "\n" for line breaks. */
export async function addText(src: Blob, o: TextOptions): Promise<Blob> {
  const img = await loadImage(src);
  const [c, ctx] = canvas(W, H);
  drawCover(ctx, img, 0, 0, W, H);
  await document.fonts.load(`100px ${o.fontFamily}`);

  const position = o.position ?? "left";
  const color = o.color || "#FFFFFF";
  const highlight = o.highlightWord?.toUpperCase().trim();
  // Models often send a literal backslash-n instead of a real newline.
  const lines = o.text.replace(/\\n/g, "\n").split("\n").map((l) => l.trim().toUpperCase()).filter(Boolean);
  if (!lines.length) return toBlob(c);

  const pad = 48;
  const [areaW, areaH] = {
    left: [W / 2 - pad, H - 2 * pad], right: [W / 2 - pad, H - 2 * pad],
    top: [W - 2 * pad, H / 3], bottom: [W - 2 * pad, H / 3], center: [W - 4 * pad, H / 2],
  }[position];

  let size = 300;
  for (; size > 20; size -= 6) {
    ctx.font = `${size}px ${o.fontFamily}`;
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (widest <= areaW && size * 1.1 * lines.length <= areaH) break;
  }
  ctx.font = `${size}px ${o.fontFamily}`;
  ctx.textBaseline = "top";
  ctx.lineJoin = "round";
  const lineH = size * 1.1;
  const blockH = lineH * lines.length;
  const stroke = Math.max(4, size / 12);
  const space = ctx.measureText(" ").width;

  lines.forEach((line, i) => {
    const lineW = ctx.measureText(line).width;
    let x = position === "left" ? pad : position === "right" ? W - pad - lineW : (W - lineW) / 2;
    const y = (position === "top" ? pad : position === "bottom" ? H - pad - blockH : (H - blockH) / 2) + i * lineH;
    for (const word of line.split(" ")) {
      const fill = highlight && word.replace(/[.,!?¡¿]/g, "") === highlight ? o.highlightColor || "#FFD400" : color;
      // Drop shadow, then outline, then fill.
      ctx.fillStyle = "#000";
      ctx.fillText(word, x + stroke, y + stroke);
      ctx.lineWidth = stroke * 2;
      ctx.strokeStyle = o.strokeColor || "#000";
      ctx.strokeText(word, x, y);
      ctx.fillStyle = fill;
      ctx.fillText(word, x, y);
      x += ctx.measureText(word).width + space;
    }
  });
  return toBlob(c);
}

/** Your thumbnails mixed in with the channel's winners at feed size, marked with a red bar, to see if they stand out. */
export async function compareSheet(candidates: Blob[], references: ImageBitmap[]): Promise<Blob> {
  const [w, h] = PREVIEW_SIZES[0];
  const cands = await Promise.all(candidates.map((b) => loadImage(b)));
  // Interleave so each candidate sits after two references, like a real feed.
  const order: [ImageBitmap, boolean][] = [];
  cands.forEach((cand, i) => {
    references.slice(i * 2, i * 2 + 2).forEach((r) => order.push([r, false]));
    order.push([cand, true]);
  });
  references.slice(cands.length * 2).forEach((r) => order.push([r, false]));
  const cols = 3;
  const rows = Math.ceil(order.length / cols);
  const [c, ctx] = canvas(cols * (w + 12) + 12, rows * (h + 12) + 12);
  ctx.fillStyle = "#0F0F0F";
  ctx.fillRect(0, 0, c.width, c.height);
  order.forEach(([img, mine], i) => {
    const x = 12 + (i % cols) * (w + 12);
    const y = 12 + Math.floor(i / cols) * (h + 12);
    drawCover(ctx, img, x, y, w, h);
    if (mine) {
      ctx.fillStyle = "#FF3B30";
      ctx.fillRect(x, y + h - 6, w, 6);
    }
  });
  return toBlob(c);
}
