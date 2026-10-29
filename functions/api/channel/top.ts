import { NotFoundError, QuotaError, topChannelVideos } from "../../../lib/youtube";
import type { Env } from "../../env";

const HANDLE = /^(@?[A-Za-z0-9._-]{3,100}|UC[A-Za-z0-9_-]{22}|https?:\/\/(www\.)?youtube\.com\/[^\s]{1,200})$/;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const params = new URL(request.url).searchParams;
  const handle = (params.get("handle") ?? "").trim();
  const n = Math.min(12, Math.max(1, Number(params.get("n")) || 8));
  if (!HANDLE.test(handle)) {
    return Response.json({ code: "bad_handle", error: "Escribe un @handle o la URL del canal." }, { status: 400 });
  }
  try {
    const data = await topChannelVideos(
      { key: env.YOUTUBE_API_KEY, cache: env.CACHE, simulateQuota: env.SIMULATE_QUOTA === "1" },
      handle,
      n,
    );
    return Response.json(data);
  } catch (e) {
    if (!env.YOUTUBE_API_KEY) {
      console.error("channel/top: YOUTUBE_API_KEY is not set");
      return Response.json({ code: "config", error: "El sitio no tiene configurada su key de YouTube." }, { status: 503 });
    }
    if (e instanceof QuotaError) {
      return Response.json(
        { code: "quota", error: "No podemos procesar tu solicitud hoy: se alcanzó el límite diario de YouTube. Vuelve mañana." },
        { status: 429 },
      );
    }
    if (e instanceof NotFoundError) {
      return Response.json({ code: "not_found", error: "No encontramos ese canal." }, { status: 404 });
    }
    console.error("channel/top", e);
    // 500, not 502: Cloudflare can swap a 502 body for its own "error code: 502" page, hiding `detail`.
    // `detail` is YouTube's message (e.g. a restricted or invalid key); it never contains the key itself.
    return Response.json(
      { code: "error", error: "No pudimos leer el canal. Prueba de nuevo.", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
};
