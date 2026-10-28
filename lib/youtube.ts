// Runs in the Cloudflare Pages Function (functions/api/channel/top.ts) with the site's YouTube key.
// Port of th-yt-mcp/yt_public.py (top_channel_videos). No Next.js imports: this is bundled by wrangler.
import type { TopVideos, Video } from "./types";

const API = "https://www.googleapis.com/youtube/v3";
const CACHE_TTL = 6 * 3600;

/** The daily quota ran out. The function turns this into a 429 with code "quota". */
export class QuotaError extends Error {}

export class NotFoundError extends Error {}

/** The subset of a Workers KV namespace this module uses. */
export type Cache = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
};

export type YouTubeEnv = { key: string; cache?: Cache; simulateQuota?: boolean };

async function yt(env: YouTubeEnv, path: string, params: Record<string, string>) {
  if (!env.key) throw new Error("YOUTUBE_API_KEY is not set");
  if (env.simulateQuota) throw new QuotaError("simulated");
  const res = await fetch(`${API}/${path}?${new URLSearchParams({ ...params, key: env.key })}`);
  const data = (await res.json()) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!res.ok) {
    const reason = data?.error?.errors?.[0]?.reason;
    if (reason === "quotaExceeded" || reason === "dailyLimitExceeded" || reason === "rateLimitExceeded") {
      throw new QuotaError(reason);
    }
    throw new Error(data?.error?.message ?? `YouTube API error ${res.status}`);
  }
  return data;
}

/** PT1H2M3S -> 3723. */
export function seconds(iso: string | undefined): number {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso ?? "");
  if (!m) return 0;
  const [d, h, mi, s] = m.slice(1).map((x) => Number(x ?? 0));
  return ((d * 24 + h) * 60 + mi) * 60 + s;
}

const int = (v: string | undefined) => (v === undefined ? null : Number(v));

async function channel(env: YouTubeEnv, handleOrId: string) {
  const h = handleOrId.trim().replace(/\/+$/, "").split("/").pop()!;
  const params: Record<string, string> = { part: "snippet,contentDetails" };
  if (/^UC[A-Za-z0-9_-]{22}$/.test(h)) params.id = h;
  else params.forHandle = h.startsWith("@") ? h : `@${h}`;
  const data = await yt(env, "channels", params);
  const item = data.items?.[0];
  if (!item) throw new NotFoundError(`Channel not found: ${handleOrId}`);
  return { id: item.id as string, title: item.snippet.title as string, uploads: item.contentDetails.relatedPlaylists.uploads as string };
}

type Uploads = { channel: string; channelId: string; videos: Video[] };

/** Last `scan` uploads with stats: ~1 unit per 50 uploads plus 1 per 50 videos, plus 1 for the channel. */
async function fetchUploads(env: YouTubeEnv, handleOrId: string, scan: number): Promise<Uploads> {
  const ch = await channel(env, handleOrId);
  const ids: string[] = [];
  let page: string | undefined;
  while (ids.length < scan) {
    const res = await yt(env, "playlistItems", {
      part: "contentDetails",
      playlistId: ch.uploads,
      maxResults: String(Math.min(50, scan - ids.length)),
      ...(page ? { pageToken: page } : {}),
    });
    ids.push(...res.items.map((i: { contentDetails: { videoId: string } }) => i.contentDetails.videoId));
    page = res.nextPageToken;
    if (!page) break;
  }
  const videos: Video[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const res = await yt(env, "videos", { part: "snippet,statistics,contentDetails", id: ids.slice(i, i + 50).join(",") });
    for (const item of res.items) {
      const st = item.statistics ?? {};
      videos.push({
        id: item.id,
        title: item.snippet.title,
        publishedAt: item.snippet.publishedAt,
        seconds: seconds(item.contentDetails?.duration),
        views: Number(st.viewCount ?? 0),
        likes: int(st.likeCount),
        comments: int(st.commentCount),
        outlierScore: null,
      });
    }
  }
  const sorted = videos.map((v) => v.views).filter(Boolean).sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  for (const v of videos) v.outlierScore = median && v.views ? Math.round((v.views / median) * 100) / 100 : null;
  return { channel: ch.title, channelId: ch.id, videos };
}

/** Uploads from KV when fresh (6 h), so repeat visits to a channel cost no quota. Errors are never cached. */
async function uploads(env: YouTubeEnv, handleOrId: string, scan: number): Promise<Uploads> {
  const key = `uploads:v1:${handleOrId}:${scan}`;
  const hit = await env.cache?.get(key);
  if (hit) return JSON.parse(hit);
  const data = await fetchUploads(env, handleOrId, scan);
  await env.cache?.put(key, JSON.stringify(data), { expirationTtl: CACHE_TTL });
  return data;
}

/** The channel's most viewed long-form videos among its last `scan` uploads. Shorts can be up to 3 minutes. */
export async function topChannelVideos(env: YouTubeEnv, handleOrId: string, n = 8, scan = 200, shortsMaxSeconds = 180): Promise<TopVideos> {
  const data = await uploads(env, handleOrId.trim().toLowerCase(), scan);
  const videos = data.videos
    .filter((v) => v.seconds > shortsMaxSeconds)
    .sort((a, b) => b.views - a.views)
    .slice(0, n);
  return { channel: data.channel, channelId: data.channelId, scanned: data.videos.length, videos };
}
