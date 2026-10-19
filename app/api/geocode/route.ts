import { NextResponse } from "next/server";
import { zoomFor, type GeoResult } from "@/lib/geocode";


const UA = "AnorixGlobe/0.4 (+https://anorix.dev; hello@anorix.dev)";
const cache = new Map<string, { at: number; results: GeoResult[] }>();
let nominatimNext = 0;

const ADMIN = new Set(["country", "state", "region", "province", "county", "district", "municipality", "city", "town", "village", "hamlet", "suburb", "quarter", "neighbourhood", "locality", "continent"]);

function kindOf(cls: string, type: string) {
  if (ADMIN.has(type)) return type;
  if (cls === "place" || cls === "boundary") return "locality";
  if (cls === "highway") return "street";
  if (type === "house" || cls === "building") return "house";
  if (type === "street") return "street";
  return "poi";
}

type MeteoHit = { id: number; name: string; latitude: number; longitude: number; feature_code?: string; population?: number; admin1?: string; admin2?: string; country?: string };

/** GeoNames (via Open-Meteo): catches small towns and villages missing from OSM, e.g. Shahodi Garhi. */
async function geonames(q: string): Promise<GeoResult[]> {
  const params = new URLSearchParams({ name: q, count: "5", language: "en", format: "json" });
  const data = (await timed(`https://geocoding-api.open-meteo.com/v1/search?${params}`, 4000)) as { results?: MeteoHit[] } | null;
  return (data?.results ?? []).map((hit) => {
    const code = hit.feature_code ?? "PPL";
    const pop = hit.population ?? 0;
    let kind = "village";
    if (code.startsWith("PCL")) kind = "country";
    else if (code === "ADM1") kind = "state";
    else if (code.startsWith("ADM")) kind = "county";
    else if (pop > 1_000_000 || code === "PPLC") kind = "city";
    else if (pop > 50_000 || code === "PPLA" || code === "PPLA2") kind = "town";
    else if (code === "PPLX") kind = "suburb";
    else if (!code.startsWith("PPL")) kind = "poi";
    const detail = [hit.admin2, hit.admin1, hit.country].filter(Boolean).join(", ");
    return { id: `g${hit.id}`, name: hit.name, detail, lat: hit.latitude, lng: hit.longitude, kind, zoom: zoomFor(kind), source: "geonames" as const };
  });
}

function norm(text: string) {
  return text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** 0: name matches the query, 1: every word appears somewhere, 2: provider guess. */
function tier(result: GeoResult, q: string) {
  const name = norm(result.name);
  const query = norm(q);
  if (name === query || name.startsWith(query) || query.startsWith(name + " ") || query.endsWith(" " + name)) return 0;
  const hay = `${name} ${norm(result.detail)}`;
  const words = query.split(/[\s,]+/).filter((word) => word.length > 1);
  if (words.length && words.every((word) => hay.includes(word))) return 1;
  return 2;
}

const ADMIN_WORDS = /\b(division|district|tehsil|taluka|subdivision|river|zone|upazila|city tehsil)\b/;

/** Prefer "Sylhet" (the city) over "Sylhet Division" when the query does not ask for the division. */
function exactness(result: GeoResult, q: string) {
  const name = norm(result.name);
  const query = norm(q).replace(/[’']/g, "'");
  if (name.replace(/[’']/g, "'") === query) return 0;
  return 1;
}

/** City > town > district/state > village > anything else, so "Swat" is the valley district, not a namesake hamlet. */
function settlement(result: GeoResult) {
  const k = result.kind;
  if (/\b(division|district|tehsil|taluka|upazila)\b/i.test(result.name)) return 2;
  if (k === "city" || k === "country") return 0;
  if (k === "town" || k === "municipality") return 1;
  if (k === "county" || k === "state" || k === "region" || k === "province" || k === "district") return 2;
  if (k === "village" || k === "suburb" || k === "locality") return 3;
  return 4;
}

async function timed(url: string, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": UA, Accept: "application/json", "Accept-Language": "en" },
      cache: "no-store",
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: Record<string, string | number | number[] | undefined> & { extent?: number[] };
};

async function photon(q: string, bias?: { lat: number; lng: number }): Promise<GeoResult[]> {
  const params = new URLSearchParams({ q, limit: "8" });
  if (bias) {
    params.set("lat", bias.lat.toFixed(3));
    params.set("lon", bias.lng.toFixed(3));
    params.set("location_bias_scale", "0.2");
  }
  const data = (await timed(`https://photon.komoot.io/api/?${params}`, 4500)) as { features?: PhotonFeature[] } | null;
  return (data?.features ?? []).map((feature, index) => {
    const p = feature.properties;
    const [lng, lat] = feature.geometry.coordinates;
    const kind = kindOf(String(p.osm_key ?? ""), String(p.osm_key === "place" || p.osm_key === "boundary" ? p.osm_value : p.name ? p.osm_value ?? "" : "house"));
    const street = p.street ? `${p.housenumber ? `${p.housenumber} ` : ""}${p.street}` : "";
    const name = String(p.name ?? street ?? "") || street || String(p.city ?? "Place");
    const detail = [name === street ? "" : street, p.district, p.city, p.county, p.state, p.country]
      .map((part) => (part ? String(part) : ""))
      .filter((part, i, all) => part && part !== name && all.indexOf(part) === i)
      .slice(0, 3)
      .join(", ");
    const e = p.extent;
    const bbox = Array.isArray(e) && e.length === 4 ? ([e[0], e[3], e[2], e[1]] as [number, number, number, number]) : null;
    return { id: `p${p.osm_type}${p.osm_id ?? index}`, name, detail, lat, lng, kind, zoom: zoomFor(kind, bbox), source: "photon" as const };
  });
}

type NominatimHit = {
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  category?: string;
  class?: string;
  type: string;
  addresstype?: string;
  boundingbox?: string[];
};

async function nominatim(q: string): Promise<GeoResult[]> {
  const wait = nominatimNext - Date.now();
  nominatimNext = Math.max(Date.now(), nominatimNext) + 1100; // public policy: max 1 req/s
  if (wait > 1500) return [];
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  const params = new URLSearchParams({ q, format: "jsonv2", limit: "8", addressdetails: "0", "accept-language": "en" });
  const data = (await timed(`https://nominatim.openstreetmap.org/search?${params}`, 5000)) as NominatimHit[] | null;
  return (data ?? []).map((hit) => {
    const kind = kindOf(hit.category ?? hit.class ?? "", hit.addresstype ?? hit.type);
    const parts = hit.display_name.split(", ");
    const name = hit.name || parts[0];
    const detail = parts.filter((part) => part !== name && !/^\d{4,6}$/.test(part)).slice(-3).join(", ");
    const b = hit.boundingbox?.map(Number);
    const bbox = b && b.length === 4 ? ([b[2], b[0], b[3], b[1]] as [number, number, number, number]) : null;
    return { id: `n${hit.osm_type}${hit.osm_id}`, name, detail, lat: Number(hit.lat), lng: Number(hit.lon), kind, zoom: zoomFor(kind, bbox), source: "nominatim" as const };
  });
}

function near(a: GeoResult, b: GeoResult) {
  return Math.abs(a.lat - b.lat) < 0.03 && Math.abs(a.lng - b.lng) < 0.03 && norm(a.name) === norm(b.name);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 200);
  if (q.length < 2) return NextResponse.json({ results: [] });
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const bias = Number.isFinite(lat) && Number.isFinite(lng) && url.searchParams.has("lat") ? { lat, lng } : undefined;
  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 10 * 60_000) return NextResponse.json({ results: hit.results });

  const [n, p, g] = await Promise.all([nominatim(q), photon(q, bias), geonames(q)]);
  const merged: GeoResult[] = [];
  for (let i = 0; i < Math.max(n.length, p.length, g.length); i += 1) {
    for (const item of [n[i], g[i], p[i]]) {
      if (item && Number.isFinite(item.lat) && !merged.some((existing) => near(existing, item))) merged.push(item);
    }
  }
  const ranked = merged
    .map((item, index) => ({ item, index, tier: tier(item, q), exact: exactness(item, q), place: settlement(item) }))
    .sort((a, b) => a.tier - b.tier || a.place - b.place || a.exact - b.exact || a.index - b.index)
    .map((entry) => entry.item);
  const results = ranked.slice(0, 7);
  if (results.length) {
    cache.set(key, { at: Date.now(), results });
    if (cache.size > 500) cache.delete(cache.keys().next().value as string);
  }
  return NextResponse.json({ results });
}
