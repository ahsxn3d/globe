"use client";

import { useEffect, useRef, useState } from "react";
import { Layers, Loader2, MapPin, Search, X } from "lucide-react";
import { parseCategory } from "@/lib/categories";
import { Input } from "@/components/ui/input";
import type { GeoResult } from "@/lib/geocode";
import { useGlobe } from "@/lib/store";

type CategoryPlace = { id: string; name: string; detail: string; lat: number; lng: number; kind: string };
type CategoryResult = { category: string | null; where: string; places: CategoryPlace[]; total?: number; message?: string; query?: string };

/** One field: filters your pins instantly and geocodes the whole world (Nominatim + Photon). */
export function PlaceSearch() {
  const globe = useGlobe();
  const [results, setResults] = useState<GeoResult[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [searched, setSearched] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const query = globe.query;
  const [cat, setCat] = useState<CategoryResult | null>(null);
  const [catLoading, setCatLoading] = useState(false);
  const liveRef = useRef(globe.livePos);
  useEffect(() => {
    liveRef.current = globe.livePos;
  }, [globe.livePos]);

  // Category queries ("schools", "colleges in Lahore", "hospitals near me") drop every match on the map.
  useEffect(() => {
    const q = query.trim();
    const parsed = q.length >= 3 ? parseCategory(q) : null;
    if (!parsed) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setCatLoading(true);
      try {
        const params = new URLSearchParams({ q });
        const view = (window as unknown as { __anorixView?: { bbox: number[] } }).__anorixView;
        if (parsed.nearMe && liveRef.current) {
          params.set("lat", String(liveRef.current.lat));
          params.set("lng", String(liveRef.current.lng));
        } else if (parsed.nearMe && "geolocation" in navigator) {
          const pos = await new Promise<GeolocationPosition | null>((resolve) =>
            navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: 6000, maximumAge: 300_000 }),
          );
          if (pos) {
            params.set("lat", String(pos.coords.latitude));
            params.set("lng", String(pos.coords.longitude));
          } else if (view) params.set("bbox", view.bbox.join(","));
        } else if (view) params.set("bbox", view.bbox.join(","));
        const response = await fetch(`/api/places?${params}`, { signal: controller.signal });
        const data = (await response.json()) as CategoryResult;
        if (controller.signal.aborted) return;
        setCat({ ...data, query: q });
        window.dispatchEvent(new CustomEvent("anorix:places", { detail: { places: data.places ?? [], fit: true } }));
      } catch {
        if (!controller.signal.aborted) setCat({ category: parsed.category.label, where: "", places: [], query: q, message: "Search failed. Try again." });
      } finally {
        if (!controller.signal.aborted) setCatLoading(false);
      }
    }, 650);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  const clearPlaces = () => {
    setCat(null);
    window.dispatchEvent(new CustomEvent("anorix:places", { detail: { places: [] } }));
  };

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        const data = (await response.json()) as { results?: GeoResult[] };
        setResults(data.results ?? []);
        setActive(0);
        setSearched(q);
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
          setSearched(q);
        }
      }
    }, 380);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    const onDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, []);

  const go = (result: GeoResult) => {
    globe.flyTo(result.lat, result.lng, result.zoom);
    setOpen(false);
  };

  const showList = open && query.trim().length >= 2;
  const fresh = searched === query.trim();
  const shown = fresh ? results.slice(0, 6) : [];
  const loading = query.trim().length >= 2 && !fresh;
  const catNow = Boolean(parseCategory(query.trim())) && (catLoading || cat?.query === query.trim());

  return (
    <div ref={wrapRef} className="relative" data-place-search>
      <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-[var(--fg-3)]" aria-hidden />
      <Input
        value={query}
        onChange={(event) => {
          globe.setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((index) => Math.min(shown.length - 1, index + 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((index) => Math.max(0, index - 1));
          } else if (event.key === "Enter" && shown[active]) {
            event.preventDefault();
            go(shown[active]);
          } else if (event.key === "Escape") setOpen(false);
        }}
        placeholder="Search a place, or try “schools in Lahore”"
        aria-label="Search places"
        role="combobox"
        aria-expanded={showList}
        aria-controls="place-results"
        autoComplete="off"
        spellCheck={false}
        className="pl-10"
      />
      {loading ? (
        <Loader2 className="absolute top-1/2 right-4 size-4 -translate-y-1/2 animate-spin text-[var(--fg-3)]" aria-hidden />
      ) : null}
      {showList ? (
        <ul
          id="place-results"
          role="listbox"
          className="place-results absolute inset-x-0 top-[calc(100%+8px)] z-40 rounded-[22px] bg-[var(--bg-1)] p-1.5"
        >
          {catNow ? (
            <li className="flex items-center gap-2 border-b border-[var(--line,rgba(127,127,127,.18))] px-3 py-2.5 text-[13px]" data-category-summary>
              <Layers className="size-3.5 shrink-0 text-[var(--fg-3)]" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-[var(--fg-1)]">
                {catLoading
                  ? `Finding ${cat?.category ?? "places"}…`
                  : cat?.places.length
                    ? `${cat.places.length}${cat.total && cat.total > cat.places.length ? "+" : ""} ${cat.category?.toLowerCase()} near ${cat.where} on the map`
                    : cat?.message ?? `No ${cat?.category ?? "places"} found here. Zoom to a city or add one, e.g. "schools in Lahore".`}
              </span>
              {cat?.places.length ? (
                <button type="button" onClick={clearPlaces} className="rounded-full p-1 text-[var(--fg-3)] hover:text-[var(--fg-1)]" aria-label="Clear results from map">
                  <X className="size-3.5" />
                </button>
              ) : null}
            </li>
          ) : null}
          {catNow && cat?.places.length
            ? cat.places.slice(0, 6).map((place) => (
                <li key={`c-${place.id}`}>
                  <button
                    type="button"
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent("anorix:places", { detail: { places: cat.places, focus: place.id } }));
                      globe.flyTo(place.lat, place.lng, 16.5);
                      setOpen(false);
                    }}
                    className="flex w-full items-start gap-2.5 rounded-2xl px-3 py-2 text-left transition-colors duration-150 hover:bg-[var(--row)]"
                  >
                    <MapPin className="mt-0.5 size-3.5 shrink-0 text-[var(--accent,#3b82f6)]" aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] text-[var(--fg-1)]">{place.name}</span>
                      <span className="block truncate text-[12px] text-[var(--fg-3)]">{place.detail || place.kind}</span>
                    </span>
                  </button>
                </li>
              ))
            : null}
          {catNow && cat?.places.length ? null : shown.length === 0 ? (
            <li className="px-3 py-2.5 text-[13px] text-[var(--fg-3)]">
              {loading ? "Searching the world" : "No places found. Try adding a city or country."}
            </li>
          ) : (
            shown.map((result, index) => (
              <li key={result.id} role="option" aria-selected={index === active}>
                <button
                  type="button"
                  data-result={result.name}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => go(result)}
                  className={`flex w-full items-start gap-2.5 rounded-2xl px-3 py-2 text-left transition-colors duration-150 ${
                    index === active ? "bg-[var(--row)]" : ""
                  }`}
                >
                  <MapPin className="mt-0.5 size-3.5 shrink-0 text-[var(--fg-3)]" aria-hidden />
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] text-[var(--fg-1)]">{result.name}</span>
                    <span className="block truncate text-[12px] text-[var(--fg-3)]">
                      {result.detail || result.kind}
                    </span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
