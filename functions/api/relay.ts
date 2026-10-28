// Forwards browser requests to image APIs that don't allow CORS (Replicate). The visitor's key arrives in a header,
// is passed on, and is never logged or stored. Only the hosts below are reachable: this is not an open proxy.

const ALLOWED_HOSTS = new Set(["api.replicate.com", "replicate.delivery"]);
const MAX_BODY = 20 * 1024 * 1024;

export const onRequest: PagesFunction = async ({ request }) => {
  if (request.method !== "GET" && request.method !== "POST") return new Response("method not allowed", { status: 405 });
  let url: URL;
  try {
    url = new URL(new URL(request.url).searchParams.get("url") ?? "");
  } catch {
    return Response.json({ error: "bad url" }, { status: 400 });
  }
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) {
    return Response.json({ error: "host not allowed" }, { status: 403 });
  }
  const body = request.method === "GET" ? undefined : await request.arrayBuffer();
  if (body && body.byteLength > MAX_BODY) return Response.json({ error: "body too large" }, { status: 413 });

  const headers: Record<string, string> = {};
  for (const [from, to] of [["x-provider-auth", "authorization"], ["content-type", "content-type"], ["prefer", "prefer"]]) {
    const value = request.headers.get(from);
    if (value) headers[to] = value;
  }
  const res = await fetch(url.toString(), { method: request.method, headers, body });
  return new Response(res.body, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/octet-stream", "cache-control": "no-store" },
  });
};
