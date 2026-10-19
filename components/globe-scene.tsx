"use client";

import { useEffect, useRef, useState } from "react";
import { Map, Marker, setWorkerUrl, type GeoJSONSource, type MapMouseEvent } from "maplibre-gl";
import { buildMapStyle, type MapMode } from "@/lib/map-style";
import { nightTileUrl, registerNightProtocol } from "@/lib/night";
import { mountSpaceField } from "@/lib/space-field";
import { useGlobe } from "@/lib/store";
import { readTheme, type MapTheme } from "@/lib/theme";
import type { Pin } from "@/lib/types";

type PlaceMarker = { id: string; name: string; detail: string; lat: number; lng: number };
import "maplibre-gl/dist/maplibre-gl.css";

const PIN_SOURCE = "anorix-pins";
const PIN_LAYER = "anorix-pin-circles";
const MODES: { id: MapMode; label: string }[] = [
  { id: "earth", label: "Earth" },
  { id: "street", label: "Street" },
  { id: "satellite", label: "Satellite" },
  { id: "hybrid", label: "Hybrid" },
  { id: "3d", label: "3D" },
];

function pinColor(pin: Pin, selectedId: string | null, theme: MapTheme) {
  if (pin.id === selectedId) return theme === "light" ? "#2563eb" : "#3b82f6";
  if (pin.visibility === "private") return theme === "light" ? "#71717a" : "#8a8a8a";
  return theme === "light" ? "#0a0a0a" : "#ededed";
}

function pinCollection(pins: Pin[], selectedId: string | null, theme: MapTheme) {
  return {
    type: "FeatureCollection" as const,
    features: pins.map((pin) => ({
      type: "Feature" as const,
      id: pin.id,
      properties: {
        id: pin.id,
        title: pin.title,
        color: pinColor(pin, selectedId, theme),
        radius: pin.id === selectedId ? 8 : 5.5,
      },
      geometry: { type: "Point" as const, coordinates: [pin.lng, pin.lat] },
    })),
  };
}

/** Space the side panel or mobile sheet covers, so Earth and pins sit in the free area. */
function sidebarPadding(host: HTMLElement) {
  const panel = document.querySelector<HTMLElement>("[data-sidebar]");
  const none = { top: 0, right: 0, bottom: 0, left: 0 };
  if (!panel) return none;
  const box = host.getBoundingClientRect();
  const side = panel.getBoundingClientRect();
  if (side.width <= 0 || side.height <= 0) return none;
  // Desktop: panel standing beside the map.
  const beside = side.width < box.width * 0.6 && side.height >= box.height * 0.6;
  if (beside) {
    const right = side.left > box.left + box.width / 2 ? Math.max(0, box.right - side.left) : 0;
    const left = right === 0 ? Math.max(0, side.right - box.left) : 0;
    return { top: 0, right: Math.round(right), bottom: 0, left: Math.round(left) };
  }
  // Mobile: bottom sheet overlays the map; pad so pins stay above it.
  const sheet = side.bottom >= box.bottom - 2 && side.top > box.top + box.height * 0.25;
  if (sheet) {
    return { top: 0, right: 0, bottom: Math.round(Math.max(0, box.bottom - side.top)), left: 0 };
  }
  return none;
}

function applyPadding(map: Map, host: HTMLElement) {
  const next = sidebarPadding(host);
  const current = map.getPadding();
  if (
    current.right === next.right &&
    current.left === next.left &&
    current.top === next.top &&
    current.bottom === next.bottom
  ) {
    return;
  }
  map.setPadding(next);
  host.dataset.padRight = String(next.right);
  host.dataset.padLeft = String(next.left);
  host.dataset.padTop = String(next.top);
  host.dataset.padBottom = String(next.bottom);
}

function publishZoom(map: Map, host: HTMLElement) {
  host.dataset.mapZoom = map.getZoom().toFixed(3);
}

export function GlobeScene() {
  const { visiblePins, selectedId, livePos, fly, openCreate, selectPin } = useGlobe();
  const hostRef = useRef<HTMLDivElement>(null);
  const starsRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<Map | null>(null);
  const needleRef = useRef<HTMLSpanElement>(null);
  const liveMarker = useRef<Marker | null>(null);
  const pinsRef = useRef(visiblePins);
  const selectedRef = useRef(selectedId);
  const flyRef = useRef(fly);
  const openCreateRef = useRef(openCreate);
  const selectPinRef = useRef(selectPin);
  const userMoved = useRef(false);
  const applied = useRef<{ mode: MapMode; theme: MapTheme } | null>(null);
  const themeRef = useRef<MapTheme>("dark");
  const hoverRef = useRef<string | null>(null);
  const [mode, setMode] = useState<MapMode>("earth");
  const [theme, setTheme] = useState<MapTheme>("dark");
  const [ready, setReady] = useState(false);
  const [pitched, setPitched] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    pinsRef.current = visiblePins;
    selectedRef.current = selectedId;
    flyRef.current = fly;
    openCreateRef.current = openCreate;
    selectPinRef.current = selectPin;
    themeRef.current = theme;
  }, [visiblePins, selectedId, fly, openCreate, selectPin, theme]);

  useEffect(() => {
    const sync = () => setTheme(readTheme());
    sync();
    window.addEventListener("anorix-theme", sync);
    return () => window.removeEventListener("anorix-theme", sync);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let map: Map | null = null;
    let spinFrame = 0;
    let cancelled = false;
    let space: ReturnType<typeof mountSpaceField> | null = null;

    const stopSpin = () => {
      userMoved.current = true;
      cancelAnimationFrame(spinFrame);
    };

    const boot = async () => {
      const initialTheme = readTheme();
      themeRef.current = initialTheme;
      applied.current = { mode: "earth", theme: initialTheme };
      space = starsRef.current
        ? mountSpaceField(starsRef.current, () => {
            const current = mapRef.current;
            if (!current) {
              return { bearing: 0, pitch: 0, zoom: 1.55, globeX: 480, globeY: 360, globeR: 220 };
            }
            const zoom = current.getZoom();
            const pitch = (current.getPitch() * Math.PI) / 180;
            const radius = (512 * 2 ** zoom) / (2 * Math.PI);
            let globeX = current.getContainer().clientWidth / 2;
            let globeY = current.getContainer().clientHeight / 2;
            try {
              const center = current.project(current.getCenter());
              globeX = center.x;
              globeY = center.y + Math.sin(pitch) * radius * 0.28;
            } catch {
              globeY += Math.sin(pitch) * radius * 0.28;
            }
            return {
              bearing: (current.getBearing() * Math.PI) / 180,
              pitch,
              zoom,
              globeX,
              globeY,
              globeR: radius,
            };
          })
        : null;
      let style;
      try {
        registerNightProtocol();
        style = await buildMapStyle("earth", initialTheme);
      } catch {
        if (!cancelled) setError("Map style failed to load");
        return;
      }
      if (cancelled || !hostRef.current) {
        space?.destroy();
        space = null;
        return;
      }

      setWorkerUrl("/maplibre-worker");
      const pending = flyRef.current;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      map = new Map({
        container: host,
        style,
        center: pending ? [pending.lng, pending.lat] : [48, 18],
        zoom: pending?.zoom ?? (host.clientWidth < 640 ? 0.85 : 1.55),
        bearing: 0,
        pitch: 0,
        minZoom: 0,
        maxZoom: 20,
        maxPitch: 75,
        hash: false,
        attributionControl: { compact: true },
        scrollZoom: true,
        dragRotate: true,
        pitchWithRotate: true,
        touchPitch: true,
        touchZoomRotate: true,
        doubleClickZoom: false,
        cooperativeGestures: false,
        renderWorldCopies: false,
        fadeDuration: 120,
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        cancelPendingTileRequestsWhileZooming: true,
        canvasContextAttributes: { alpha: true, antialias: false },
      });
      mapRef.current = map;
      (window as unknown as { __map?: Map }).__map = map;
      map.once("load", () => host.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show"));
      applyPadding(map, host);

      map.on("error", (event) => {
        const message = event.error?.message ?? "";
        if (/tile|fetch|ajax|404|glyph|sprite|image/i.test(message)) return;
        setError(message || "Map failed to render");
      });

      map.on("styleimagemissing", (event) => {
        if (!map || map.hasImage(event.id)) return;
        map.addImage(event.id, { width: 1, height: 1, data: new Uint8Array(4) });
      });

      map.on("style.load", () => {
        const current = mapRef.current;
        if (!current) return;
        if (!current.getSource(PIN_SOURCE)) {
          current.addSource(PIN_SOURCE, {
            type: "geojson",
            data: pinCollection(pinsRef.current, selectedRef.current, themeRef.current),
          });
          current.addLayer({
            id: PIN_LAYER,
            type: "circle",
            source: PIN_SOURCE,
            paint: {
              "circle-radius": ["get", "radius"],
              "circle-color": ["get", "color"],
              "circle-stroke-width": 1,
              "circle-stroke-color": themeRef.current === "light" ? "#ffffff" : "#000000",
              "circle-pitch-alignment": "viewport",
            },
          });
        }
      });

      const nightTimer = window.setInterval(() => {
        const src = map?.getSource("night") as unknown as { setTiles?: (t: string[]) => void } | undefined;
        src?.setTiles?.([nightTileUrl()]);
      }, 600_000);
      map.once("remove", () => window.clearInterval(nightTimer));
      map.on("load", () => {
        if (cancelled || !map) return;
        publishZoom(map, host);
        space?.sync();
        setReady(true);
        if (!reduce && !userMoved.current && !flyRef.current) {
          const spin = () => {
            const current = mapRef.current;
            if (!current || userMoved.current || current.getZoom() >= 2.15) return;
            current.setBearing(current.getBearing() + 0.12);
            spinFrame = requestAnimationFrame(spin);
          };
          spinFrame = requestAnimationFrame(spin);
        }
      });

      const paintNeedle = () => {
        if (needleRef.current && map) {
          needleRef.current.style.transform = `rotate(${-map.getBearing()}deg)`;
        }
      };
      map.on("rotate", paintNeedle);
      map.on("move", () => space?.sync());
      map.on("zoom", () => {
        if (map) publishZoom(map, host);
        if (map && map.getZoom() >= 2.15) stopSpin();
      });
      map.on("pitchend", () => {
        if (map) setPitched(map.getPitch() > 8);
      });
      const publishBounds = () => {
        if (!map) return;
        const b = map.getBounds();
        (window as unknown as { __anorixView?: unknown }).__anorixView = {
          bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
          zoom: map.getZoom(),
        };
      };
      map.on("moveend", publishBounds);
      map.once("load", publishBounds);
      map.on("dragstart", stopSpin);
      map.on("wheel", stopSpin);
      map.on("pitchstart", stopSpin);

      map.on("mousemove", (event) => {
        const current = mapRef.current;
        if (!current?.getLayer(PIN_LAYER)) return;
        const hits = current.queryRenderedFeatures(event.point, { layers: [PIN_LAYER] });
        const title = typeof hits[0]?.properties?.title === "string" ? hits[0].properties.title : null;
        if (hoverRef.current !== title) {
          hoverRef.current = title;
          setHover(title);
        }
        current.getCanvas().style.cursor = title ? "pointer" : "grab";
      });

      map.on("click", (event: MapMouseEvent) => {
        const current = mapRef.current;
        if (!current) return;
        stopSpin();
        if (current.getLayer(PIN_LAYER)) {
          const pad = 8;
          const hits = current.queryRenderedFeatures(
            [
              [event.point.x - pad, event.point.y - pad],
              [event.point.x + pad, event.point.y + pad],
            ],
            { layers: [PIN_LAYER] },
          );
          const id = hits[0]?.properties?.id;
          if (typeof id === "string" && id) {
            selectPinRef.current(id, true);
            return;
          }
        }
        openCreateRef.current(event.lngLat.lat, event.lngLat.lng);
      });
    };

    void boot();

    const observer = new ResizeObserver(() => {
      const current = mapRef.current;
      if (current) {
        current.resize();
        applyPadding(current, host);
      }
      space?.resize();
    });
    observer.observe(host);
    const panel = document.querySelector<HTMLElement>("[data-sidebar]");
    if (panel) observer.observe(panel);
    const onWindow = () => mapRef.current && applyPadding(mapRef.current, host);
    window.addEventListener("resize", onWindow);

    return () => {
      cancelled = true;
      cancelAnimationFrame(spinFrame);
      observer.disconnect();
      window.removeEventListener("resize", onWindow);
      space?.destroy();
      liveMarker.current?.remove();
      liveMarker.current = null;
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = map.getSource(PIN_SOURCE) as GeoJSONSource | undefined;
    if (source && "setData" in source) source.setData(pinCollection(visiblePins, selectedId, theme));
    if (map.getLayer(PIN_LAYER)) {
      map.setPaintProperty(PIN_LAYER, "circle-stroke-color", theme === "light" ? "#ffffff" : "#000000");
    }
  }, [visiblePins, selectedId, ready, mode, theme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!livePos) {
      liveMarker.current?.remove();
      liveMarker.current = null;
      return;
    }
    if (!liveMarker.current) {
      const element = document.createElement("div");
      element.className = "live-marker";
      element.title = "Live location";
      liveMarker.current = new Marker({ element, anchor: "center" })
        .setLngLat([livePos.lng, livePos.lat])
        .addTo(map);
      return;
    }
    liveMarker.current.setLngLat([livePos.lng, livePos.lat]);
  }, [livePos, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let markers: Marker[] = [];
    const clear = () => {
      markers.forEach((marker) => marker.remove());
      markers = [];
    };
    const onPlaces = (event: Event) => {
      const detail = (event as CustomEvent<{ places: PlaceMarker[]; fit?: boolean; focus?: string }>).detail;
      clear();
      if (!detail?.places?.length) return;
      for (const place of detail.places) {
        const element = document.createElement("button");
        element.type = "button";
        element.className = "place-hit";
        element.title = place.detail ? `${place.name} \u00b7 ${place.detail}` : place.name;
        element.setAttribute("aria-label", place.name);
        element.dataset.placeHit = place.id;
        if (place.id === detail.focus) element.dataset.focus = "true";
        const label = document.createElement("span");
        label.textContent = place.name;
        element.appendChild(label);
        markers.push(new Marker({ element, anchor: "center" }).setLngLat([place.lng, place.lat]).addTo(map));
      }
      if (detail.fit && detail.places.length > 1) {
        let w = 180, s = 90, e = -180, n = -90;
        for (const p of detail.places) {
          w = Math.min(w, p.lng); e = Math.max(e, p.lng); s = Math.min(s, p.lat); n = Math.max(n, p.lat);
        }
        userMoved.current = true;
        map.fitBounds([[w, s], [e, n]], { padding: (() => { const pad = sidebarPadding(map.getContainer()); return { ...pad, top: pad.top + 80, bottom: pad.bottom + 40, left: pad.left + 40, right: pad.right + 40 }; })(), maxZoom: 15, duration: 1600 });
      } else if (detail.fit) {
        userMoved.current = true;
        map.flyTo({ center: [detail.places[0].lng, detail.places[0].lat], zoom: 15, padding: sidebarPadding(map.getContainer()) });
      }
    };
    window.addEventListener("anorix:places", onPlaces);
    return () => {
      window.removeEventListener("anorix:places", onPlaces);
      clear();
    };
  }, [ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !fly) return;
    userMoved.current = true;
    map.flyTo({
      center: [fly.lng, fly.lat],
      zoom: fly.zoom,
      padding: sidebarPadding(map.getContainer()),
      duration: Math.min(4200, 1400 + Math.abs(map.getZoom() - fly.zoom) * 160),
      essential: true,
    });
  }, [fly, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (applied.current?.mode === mode && applied.current.theme === theme) return;
    if (mode === "satellite" && applied.current?.mode === "satellite") {
      applied.current = { mode, theme };
      return;
    }
    applied.current = { mode, theme };
    let cancel = false;
    void buildMapStyle(mode, theme)
      .then((style) => {
        if (cancel || mapRef.current !== map) return;
        map.setStyle(style, { diff: false });
        if ((mode === "3d") && map.getPitch() < 20) map.easeTo({ pitch: 58, duration: 700 });
      })
      .catch(() => {
        if (!cancel) setError("Map style failed to load");
      });
    return () => {
      cancel = true;
    };
  }, [mode, theme, ready]);

  const zoomBy = (delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    userMoved.current = true;
    map.easeTo({ zoom: map.getZoom() + delta, duration: 220 });
  };

  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-black">
      <div className="absolute inset-0 bg-black">
        <canvas ref={starsRef} className="space-field absolute inset-0 h-full w-full" aria-hidden />
        <div ref={hostRef} className="globe-host relative z-[1] h-full w-full" data-map-zoom="0" />
      </div>

      {hover ? (
        <div className="pointer-events-none absolute top-[4.5rem] left-4 z-10 max-w-[min(280px,calc(100%-2rem))] truncate rounded-full bg-[var(--bg)] px-3 py-1.5 text-[13px] text-[var(--fg-1)]">
          {hover}
        </div>
      ) : null}

      {!ready && !error ? (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
          <p className="eyebrow">Loading Earth</p>
        </div>
      ) : null}

      {error ? (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center px-6 text-center">
          <p className="eyebrow">{error}</p>
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-0 z-10">
        <div
          className="pointer-events-auto absolute top-4 left-4 flex h-9 items-center gap-0.5 rounded-full bg-[var(--bg)] p-1"
          role="group"
          aria-label="Map style"
        >
          {MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={mode === item.id}
              className={`h-8 rounded-full px-3 text-[13px] font-medium transition-colors duration-150 ${
                mode === item.id
                  ? "bg-[var(--pill)] text-[var(--pill-ink)]"
                  : "text-[var(--fg-3)] hover:text-[var(--fg-1)]"
              }`}
              onClick={() => setMode(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="pointer-events-auto absolute bottom-[calc(42dvh+1rem)] left-4 flex flex-col gap-1.5 md:bottom-16">
          <div className="flex flex-col overflow-hidden rounded-full bg-[var(--bg)]">
            <button type="button" className="grid size-9 place-items-center text-[18px] text-[var(--fg-1)] hover:bg-[var(--row)]" aria-label="Zoom in" onClick={() => zoomBy(1)}>
              +
            </button>
            <button type="button" className="grid size-9 place-items-center text-[18px] text-[var(--fg-1)] hover:bg-[var(--row)]" aria-label="Zoom out" onClick={() => zoomBy(-1)}>
              −
            </button>
          </div>
          <button
            type="button"
            className="grid size-9 place-items-center rounded-full bg-[var(--bg)] text-[var(--fg-1)] hover:bg-[var(--row)]"
            aria-label="Reset north"
            onClick={() => {
              userMoved.current = true;
              mapRef.current?.easeTo({ bearing: 0, duration: 400 });
            }}
          >
            <span ref={needleRef} className="block size-4">
              <svg viewBox="0 0 16 16" aria-hidden>
                <path d="M8 1.5 11.2 9.2 8 7.8 4.8 9.2 Z" fill="var(--fg-1)" />
                <path d="M8 14.5 11.2 6.8 8 8.2 4.8 6.8 Z" fill="var(--accent)" />
              </svg>
            </span>
          </button>
          <button
            type="button"
            className={`grid h-9 place-items-center rounded-full bg-[var(--bg)] px-2 font-mono text-[10px] tracking-[0.08em] uppercase hover:bg-[var(--row)] ${pitched ? "text-[var(--accent)]" : "text-[var(--fg-2)]"}`}
            aria-label="Toggle pitch"
            aria-pressed={pitched}
            onClick={() => {
              const map = mapRef.current;
              if (!map) return;
              userMoved.current = true;
              const next = map.getPitch() > 8 ? 0 : 60;
              map.easeTo({ pitch: next, duration: 500 });
              setPitched(next > 8);
            }}
          >
            Tilt
          </button>
        </div>
        <p className="pointer-events-none absolute bottom-4 left-16 hidden font-mono text-[11px] tracking-[0.08em] text-[var(--fg-3)] uppercase md:block">
          Scroll to zoom · right-drag to tilt · click to pin
        </p>
        <p className="pointer-events-none absolute right-4 bottom-[calc(42dvh+0.75rem)] font-mono text-[11px] tracking-[0.08em] text-[var(--fg-3)] uppercase md:hidden">
          Pinch · two-finger tilt · tap to pin
        </p>
      </div>
    </div>
  );
}
