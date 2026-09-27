import { parseListing } from "@/lib/import/parse";
import { portalFor, SUPPORTED_PORTALS } from "@/lib/import/types";

/*
 * POST /api/import { url } → ImportedListing
 * Fetches a listing page from a supported real estate portal and extracts its data.
 * Only portal hosts are fetched (also after redirects), so this cannot be used
 * to reach arbitrary or internal addresses.
 */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
const MAX_HTML = 6_000_000;

const fail = (status: number, error: string) => Response.json({ error }, { status });

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { url?: unknown };
  let url: URL;
  try {
    url = new URL(String(body.url ?? "").trim());
  } catch {
    return fail(400, "To nie jest poprawny link do ogłoszenia.");
  }
  if (!/^https?:$/.test(url.protocol) || !portalFor(url.hostname)) {
    return fail(400, `Obsługujemy linki z portali: ${SUPPORTED_PORTALS.map((p) => p.name).join(", ")}.`);
  }

  let res: Response | null = null;
  for (let hop = 0; hop < 4; hop++) {
    res = await fetch(url, {
      headers: { "user-agent": UA, "accept-language": "pl-PL,pl;q=0.9", accept: "text/html,application/xhtml+xml" },
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    }).catch(() => null);
    if (!res) return fail(502, "Portal nie odpowiada. Spróbuj ponownie za chwilę.");
    const location = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
    if (!location) break;
    const next = new URL(location, url);
    if (!/^https?:$/.test(next.protocol) || !portalFor(next.hostname)) return fail(400, "Link przekierowuje poza portal z ogłoszeniami.");
    url = next;
  }
  if (!res || !res.ok) {
    return fail(502, `Portal nie udostępnił ogłoszenia (kod ${res?.status ?? "?"}). Sprawdź, czy ogłoszenie jest aktywne, albo uzupełnij dane ręcznie.`);
  }

  const html = (await res.text()).slice(0, MAX_HTML);
  const listing = parseListing(html, url.toString());
  if (!listing) return fail(422, "Nie znaleźliśmy danych ogłoszenia pod tym linkiem.");
  return Response.json(listing, { headers: { "cache-control": "no-store" } });
}
