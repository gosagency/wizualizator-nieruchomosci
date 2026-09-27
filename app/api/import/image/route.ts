/*
 * GET /api/import/image?url=… → the photo bytes.
 * Fallback when a portal CDN answers without CORS headers (some Otodom/OLX edge
 * caches do). Only image files from portal photo CDNs are relayed.
 */

const IMAGE_HOSTS = ["olxcdn.com"];
const MAX_BYTES = 15 * 1024 * 1024;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("url") ?? "";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return new Response("bad url", { status: 400 });
  }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || !IMAGE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
    return new Response("host not allowed", { status: 400 });
  }
  const res = await fetch(url, { headers: { "user-agent": UA }, redirect: "error", signal: AbortSignal.timeout(15_000) }).catch(() => null);
  const type = res?.headers.get("content-type") ?? "";
  if (!res?.ok || !type.startsWith("image/")) return new Response("not found", { status: 502 });
  const body = await res.arrayBuffer();
  if (body.byteLength > MAX_BYTES) return new Response("too large", { status: 413 });
  return new Response(body, { headers: { "content-type": type, "cache-control": "public, max-age=86400" } });
}
