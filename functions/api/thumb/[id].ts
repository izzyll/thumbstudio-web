// Same-origin copy of a YouTube thumbnail, so the browser can read its pixels in a canvas.

export const onRequestGet: PagesFunction = async ({ params }) => {
  const id = String(params.id);
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return new Response("bad id", { status: 400 });
  for (const size of ["maxresdefault", "hqdefault"]) {
    // cf.cacheTtl keeps the image in Cloudflare's edge cache, so repeat requests don't reach YouTube.
    const res = await fetch(`https://i.ytimg.com/vi/${id}/${size}.jpg`, { cf: { cacheTtl: 86400, cacheEverything: true } });
    if (res.ok) {
      return new Response(res.body, {
        headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=86400, immutable" },
      });
    }
  }
  return new Response("not found", { status: 404 });
};
