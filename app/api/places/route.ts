import { NextResponse } from "next/server";
import { parseCategory } from "@/lib/categories";

const UA = "AnorixGlobe/0.4 (+https://anorix.dev; hello@anorix.dev)";
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const cache = new Map<string, { at: number; body: unknown }>();
let nominatimNext = 0;

export type PlaceHit = { id: string; name: string; detail: string; lat: number; lng: number; kind: string };
type BBox = [number, number, number, number]; // west, south, east, north

async function getJson(url: string, ms: number, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, cache: "no-store", headers: { "User-Agent": UA, Accept: "application/json", "Accept-Language": "en", ...(init?.headers ?? {}) } });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function nominatim(params: Record<string, string>) {
  const wait = nominatimNext - Date.now();
  nominatimNext = Math.max(Date.now(), nominatimNext) + 1100; // public policy: max 1 req/s
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(wait, 2500)));
  const search = new URLSearchParams({ format: "jsonv2", "accept-language": "en", ...params });
  return ((await getJson(`https://nominatim.openstreetmap.org/search?${search}`, 7000)) ?? []) as Array<{ lat: string; lon: string; name?: string; display_name: string; type: string; osm_type: string; osm_id: number; boundingbox?: string[] }>;
}

/** Bounding box of a named city/region; clamped so Overpass stays fast. */
async function areaFor(place: string): Promise<{ bbox: BBox; label: string } | null> {
  const hits = await nominatim({ q: place, limit: "1" });
  const hit = hits[0];
  if (!hit?.boundingbox) return null;
  const [s, n, w, e] = hit.boundingbox.map(Number);
  const lat = Number(hit.lat), lng = Number(hit.lon);
  const half = 0.35; // ~40 km around the centre at most
  return {
    bbox: [Math.max(w, lng - half), Math.max(s, lat - half), Math.min(e, lng + half), Math.min(n, lat + half)],
    label: hit.name || hit.display_name.split(", ")[0],
  };
}

async function overpass(tags: string[], bbox: BBox, limit: number): Promise<PlaceHit[] | null> {
  const [w, s, e, n] = bbox.map((v) => v.toFixed(4));
  const box = `(${s},${w},${n},${e})`;
  const body = `[out:json][timeout:8];(${tags.map((t) => `nwr${t}["name"]${box};`).join("")});out center ${limit};`;
  for (const endpoint of OVERPASS) {
    const data = (await getJson(endpoint, 9000, { method: "POST", body: new URLSearchParams({ data: body }), headers: { "Content-Type": "application/x-www-form-urlencoded" } })) as { elements?: Array<{ type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }> } | null;
    if (!data?.elements) continue;
    return data.elements
      .map((el) => {
        const lat = el.lat ?? el.center?.lat;
        const lng = el.lon ?? el.center?.lon;
        const t = el.tags ?? {};
        const kind = t.amenity ?? t.tourism ?? t.leisure ?? t.shop ?? t.railway ?? t.aeroway ?? "place";
        const detail = [t["addr:street"], t["addr:city"] ?? t["addr:district"]].filter(Boolean).join(", ");
        return { id: `${el.type}${el.id}`, name: t["name:en"] ?? t.name ?? "", detail, lat: lat as number, lng: lng as number, kind: kind.replace(/_/g, " ") };
      })
      .filter((p) => p.name && Number.isFinite(p.lat) && Number.isFinite(p.lng));
  }
  return null;
}


/** `["amenity"~"^(a|b)$"]` -> ["amenity:a","amenity:b"] for Photon's osm_tag filter. */
function photonTags(tags: string[]) {
  const out: string[] = [];
  for (const tag of tags) {
    const m = tag.match(/^\["(\w+)"(=|~)"\^?\(?([^"$)]+)\)?\$?"\]/);
    if (!m) continue;
    for (const value of m[3].split("|")) out.push(`${m[1]}:${value}`);
  }
  return out;
}

type PhotonFeature = { geometry: { coordinates: [number, number] }; properties: Record<string, string | number | undefined> };

/** Photon (komoot) filtered by OSM tag + bbox: fast and independent of Overpass. */
async function photonCategory(words: string[], tags: string[], bbox: BBox | null, place: string | null): Promise<PlaceHit[]> {
  const osmTags = photonTags(tags).slice(0, 5);
  // Photon needs a text query: search each tag value by its own word ("school", "university").
  const runs = (osmTags.length ? osmTags : [""]).map(async (osmTag) => {
    const term = osmTag ? osmTag.split(":")[1].replace(/_/g, " ") : words[0];
    const params = new URLSearchParams({ q: place ? `${term} ${place}` : term, limit: osmTags.length > 1 ? "30" : "50", lang: "en" });
    if (osmTag) params.set("osm_tag", osmTag);
    if (bbox) params.set("bbox", bbox.map((v) => v.toFixed(4)).join(","));
    const data = (await getJson(`https://photon.komoot.io/api/?${params}`, 8000)) as { features?: PhotonFeature[] } | null;
    return (data?.features ?? []).map((f) => {
      const p = f.properties;
      const [lng, lat] = f.geometry.coordinates;
      const detail = [p.street, p.district ?? p.city].filter(Boolean).map(String).join(", ");
      return { id: `p${p.osm_type}${p.osm_id}`, name: String(p.name ?? ""), detail, lat, lng, kind: String(p.osm_value ?? "place").replace(/_/g, " ") };
    });
  });
  const seen = new Set<string>();
  return (await Promise.all(runs)).flat().filter((h) => h.name && Number.isFinite(h.lat) && !seen.has(h.id) && seen.add(h.id) !== undefined);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 200);
  const parsed = parseCategory(q);
  if (!parsed) return NextResponse.json({ category: null, places: [] });
  const { category, place } = parsed;

  let bbox: BBox | null = null;
  let where = "this area";
  if (place) {
    const area = await areaFor(place);
    if (!area) return NextResponse.json({ category: category.label, where: place, places: [], message: `Couldn't find "${place}".` });
    bbox = area.bbox;
    where = area.label;
  } else {
    const raw = (url.searchParams.get("bbox") ?? "").split(",").map(Number);
    const lat = Number(url.searchParams.get("lat"));
    const lng = Number(url.searchParams.get("lng"));
    if (raw.length === 4 && raw.every(Number.isFinite)) {
      const [w, s, e, n] = raw;
      const cx = (w + e) / 2, cy = (s + n) / 2;
      const half = Math.min(0.35, Math.max(e - w, n - s) / 2);
      // Very wide (globe) views are clamped to the centre so Overpass answers quickly.
      bbox = e - w > 0.7 || n - s > 0.7 ? [cx - half, cy - half, cx + half, cy + half] : [w, s, e, n];
      where = e - w > 0.7 || n - s > 0.7 ? "the map centre" : "this view";
    } else if (Number.isFinite(lat) && Number.isFinite(lng) && url.searchParams.has("lat")) {
      bbox = [lng - 0.1, lat - 0.1, lng + 0.1, lat + 0.1];
      where = "you";
    }
  }

  const key = `${category.id}|${bbox?.map((v) => v.toFixed(2)).join(",") ?? "world"}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 15 * 60_000) return NextResponse.json(hit.body);

  // Overpass is the most complete; Photon runs alongside so a busy Overpass never leaves the map empty.
  const [fromOverpass, fromPhoton] = await Promise.all([
    bbox ? overpass(category.tags, bbox, 200) : Promise.resolve(null),
    photonCategory(category.words, category.tags, bbox, null),
  ]);
  let places: PlaceHit[] = fromOverpass?.length ? fromOverpass : fromPhoton;
  if (!places.length) {
    // Last resort: Nominatim free-text category search ("school in Lahore").
    const term = category.words[0];
    const params: Record<string, string> = { q: place ? `${term} in ${place}` : term, limit: "40" };
    if (bbox && !place) {
      params.viewbox = bbox.join(",");
      params.bounded = "1";
    }
    places = (await nominatim(params)).map((h) => ({ id: `n${h.osm_type}${h.osm_id}`, name: h.name || h.display_name.split(", ")[0], detail: h.display_name.split(", ").slice(1, 3).join(", "), lat: Number(h.lat), lng: Number(h.lon), kind: h.type.replace(/_/g, " ") }));
  }
  const body = { category: category.label, where, places: places.slice(0, 200), total: places.length };
  if (places.length) {
    cache.set(key, { at: Date.now(), body });
    if (cache.size > 300) cache.delete(cache.keys().next().value as string);
  }
  return NextResponse.json(body);
}
