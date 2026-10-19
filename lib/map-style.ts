import type { SkySpecification, StyleSpecification } from "@maplibre/maplibre-gl-style-spec";
import type { MapTheme } from "@/lib/theme";

import { nightTileUrl } from "@/lib/night";

export type MapMode = "earth" | "street" | "satellite" | "hybrid" | "3d";

const LIBERTY_URL = "https://tiles.openfreemap.org/styles/liberty";

const ESRI_ATTRIBUTION =
  "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community";

type MutableLayer = {
  id: string;
  type: string;
  source?: string;
  layout?: Record<string, unknown>;
  paint?: Record<string, unknown>;
  maxzoom?: number;
  minzoom?: number;
};

type MutableStyle = {
  version: 8;
  name?: string;
  sources: Record<string, Record<string, unknown>>;
  layers: MutableLayer[];
  sprite?: StyleSpecification["sprite"];
  glyphs?: string;
  sky?: SkySpecification;
  light?: StyleSpecification["light"];
  projection?: { type: "globe" };
  terrain?: { source: string; exaggeration: number };
};

const SKY: SkySpecification = {
  "sky-color": "rgba(0, 0, 0, 0)",
  "horizon-color": "#2a5a8f",
  "fog-color": "rgba(0, 0, 0, 0)",
  "sky-horizon-blend": 0.5,
  "horizon-fog-blend": 0.35,
  "fog-ground-blend": 0.12,
  "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 0.35, 3, 0.12, 6, 0],
};

let libertyPromise: Promise<MutableStyle> | null = null;

function loadLiberty() {
  if (!libertyPromise) {
    libertyPromise = fetch(LIBERTY_URL).then(async (response) => {
      if (!response.ok) throw new Error("OpenFreeMap style failed to load");
      return (await response.json()) as MutableStyle;
    });
  }
  return libertyPromise;
}

function paintOf(layer: MutableLayer) {
  layer.paint = layer.paint ?? {};
  return layer.paint;
}

function hide(layer: MutableLayer) {
  layer.layout = { ...(layer.layout ?? {}), visibility: "none" };
}

function show(layer: MutableLayer) {
  if (layer.layout?.visibility === "none") layer.layout.visibility = "visible";
}

function isLandCover(id: string) {
  return (
    id === "natural_earth" ||
    id === "park" ||
    id === "park_outline" ||
    id === "water" ||
    id === "building" ||
    id === "building-3d" ||
    id === "road_area_pattern" ||
    id.startsWith("landuse_") ||
    id.startsWith("landcover_") ||
    id === "aeroway_fill"
  );
}

/** Legible night palette (Google / Apple Maps dark style), tuned for the Anorix monochrome UI. */
const NIGHT = {
  background: "#1b1d22",
  land: "#1f2228",
  landuse: "#23262d",
  park: "#1d2a24",
  wood: "#1c2622",
  water: "#0f2236",
  waterLine: "#2d5274",
  building: "#2b2f37",
  buildingLine: "#353a44",
  extrusion: "#3a3f49",
  casing: "#121418",
  minor: "#353a43",
  secondary: "#4b515c",
  primary: "#5d6573",
  motorway: "#7b8494",
  rail: "#4a4f58",
  boundary: "#6b7280",
  label: "#c9ced6",
  labelSoft: "#9aa1ac",
  labelWater: "#7ea3c7",
  labelPark: "#86a892",
  halo: "#15171b",
};

function roadWidthBoost(paint: Record<string, unknown>) {
  // Keep Liberty widths but never let minor roads vanish at city zooms.
  if (paint["line-opacity"] === undefined) paint["line-opacity"] = 1;
}

function darkenVector(layer: MutableLayer, roads: "dark" | "light") {
  const paint = paintOf(layer);
  const id = layer.id;
  const hybrid = roads === "light";

  if (id === "background") paint["background-color"] = hybrid ? "#000000" : NIGHT.background;

  if (id === "natural_earth") {
    // Low-zoom shaded relief: dim but visible, fades as vector land takes over.
    paint["raster-saturation"] = -0.55;
    paint["raster-contrast"] = 0.05;
    paint["raster-brightness-min"] = 0.02;
    paint["raster-brightness-max"] = 0.42;
    paint["raster-opacity"] = ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 0.6, 8, 0];
  }

  if (layer.type === "fill") {
    if (id === "water") paint["fill-color"] = NIGHT.water;
    else if (id === "building") {
      paint["fill-color"] = NIGHT.building;
      paint["fill-outline-color"] = NIGHT.buildingLine;
      delete layer.maxzoom;
    } else if (id.startsWith("park") || /grass|meadow|scrub/.test(id)) {
      paint["fill-color"] = NIGHT.park;
      paint["fill-opacity"] = 0.9;
    } else if (/wood|forest/.test(id)) {
      paint["fill-color"] = NIGHT.wood;
      paint["fill-opacity"] = 0.8;
    } else if (id.startsWith("landcover") || id.startsWith("landuse")) {
      paint["fill-color"] = NIGHT.landuse;
      paint["fill-opacity"] = id.startsWith("landcover") ? 0.6 : 0.9;
    } else if (id.startsWith("aeroway")) paint["fill-color"] = "#2a2d34";
    else paint["fill-color"] = NIGHT.land;
    delete paint["fill-pattern"];
    if (id === "landcover_wetland" || id === "road_area_pattern") hide(layer);
  }

  if (layer.type === "line") {
    roadWidthBoost(paint);
    delete paint["line-pattern"];
    if (id.includes("waterway")) paint["line-color"] = hybrid ? "#d6dde6" : NIGHT.waterLine;
    else if (id.includes("casing")) paint["line-color"] = hybrid ? "#0a0a0a" : NIGHT.casing;
    else if (id.includes("rail") || id.includes("transit")) paint["line-color"] = hybrid ? "#ededed" : NIGHT.rail;
    else if (id.startsWith("boundary")) paint["line-color"] = hybrid ? "#ededed" : NIGHT.boundary;
    else if (id.includes("motorway")) paint["line-color"] = hybrid ? "#ffffff" : NIGHT.motorway;
    else if (id.includes("trunk") || id.includes("primary")) paint["line-color"] = hybrid ? "#ffffff" : NIGHT.primary;
    else if (id.includes("secondary") || id.includes("tertiary")) paint["line-color"] = hybrid ? "#f2f2f2" : NIGHT.secondary;
    else if (id.includes("path") || id.includes("pedestrian") || id.includes("track")) paint["line-color"] = hybrid ? "#d0d0d0" : "#30343b";
    else if (id.startsWith("park")) paint["line-color"] = "#2a3a30";
    else paint["line-color"] = hybrid ? "#e4e4e4" : NIGHT.minor;
  }

  if (layer.type === "fill-extrusion") {
    paint["fill-extrusion-color"] = NIGHT.extrusion;
    paint["fill-extrusion-opacity"] = 0.92;
  }

  if (layer.type === "symbol") {
    const strong = /country|capital|label_city|state/.test(id);
    let color = hybrid || strong ? "#eef0f3" : NIGHT.label;
    if (/water|ocean|sea|lake|river/.test(id)) color = hybrid ? "#cfe3f5" : NIGHT.labelWater;
    else if (id.startsWith("poi") && !hybrid) color = NIGHT.labelSoft;
    else if (/park/.test(id) && !hybrid) color = NIGHT.labelPark;
    else if (id.includes("highway") || id.includes("road")) color = hybrid ? "#ffffff" : NIGHT.labelSoft;
    paint["text-color"] = color;
    paint["text-halo-color"] = hybrid ? "rgba(0,0,0,0.85)" : NIGHT.halo;
    paint["text-halo-width"] = 1.4;
    paint["text-halo-blur"] = 0.4;
    if (id.startsWith("poi") || id === "airport") paint["icon-opacity"] = hybrid ? 0 : 0.55;
    if (id.includes("shield")) hide(layer);
  }
}

function esriSource() {
  return {
    type: "raster",
    tiles: ["/satellite/{z}/{y}/{x}"],
    tileSize: 256,
    maxzoom: 19,
    attribution: ESRI_ATTRIBUTION,
  };
}

function terrainSource() {
  return {
    type: "raster-dem",
    tiles: ["/terrain/{z}/{x}/{y}"],
    encoding: "terrarium",
    tileSize: 256,
    maxzoom: 15,
    attribution: "Terrain © AWS Terrain Tiles (Terrarium)",
  };
}

function nightSource() {
  return {
    type: "raster",
    tiles: [nightTileUrl()],
    tileSize: 256,
    maxzoom: 8,
    attribution: "Night lights: NASA Black Marble (GIBS)",
  };
}

function nightLayer(): MutableLayer {
  return { id: "night", type: "raster", source: "night", paint: { "raster-opacity": 1, "raster-fade-duration": 0, "raster-resampling": "linear" } };
}

function hillshadeLayer(): MutableLayer {
  return {
    id: "hillshade",
    type: "hillshade",
    source: "terrain-shade",
    paint: {
      "hillshade-exaggeration": ["interpolate", ["linear"], ["zoom"], 3, 0.25, 9, 0.45, 14, 0.3],
      "hillshade-shadow-color": "rgba(10,14,22,0.55)",
      "hillshade-highlight-color": "rgba(255,248,235,0.22)",
      "hillshade-accent-color": "rgba(0,0,0,0.15)",
      "hillshade-illumination-anchor": "map",
    },
  };
}

function satelliteLayer(): MutableLayer {
  return {
    id: "satellite",
    type: "raster",
    source: "esri",
    paint: { "raster-opacity": 1, "raster-fade-duration": 0 },
  };
}

export async function buildMapStyle(mode: MapMode, theme: MapTheme = "dark"): Promise<StyleSpecification> {
  const liberty = await loadLiberty();
  const style = structuredClone(liberty) as MutableStyle;
  style.projection = { type: "globe" };
  style.sky = SKY;
  style.light = {
    anchor: "map",
    position: [1.4, 128, 36],
    color: "#fff4e6",
    intensity: 0.28,
  };
  delete style.terrain;

  const earth = style.sources.ne2_shaded;
  if (earth && !earth.attribution) earth.attribution = "Natural Earth";

  if (mode === "earth") {
    // Photoreal default: Esri imagery, real terrain + hillshade, live day/night with
    // Black Marble lights, atmosphere, 3D buildings and only place labels on top.
    const keep = style.layers.filter(
      (l) => l.id === "building-3d" || (l.type === "symbol" && /^(label_country|label_state|label_city|label_town|label_village|label_other|water_name|place)/.test(l.id)),
    );
    for (const l of keep) {
      if (l.type === "symbol") darkenVector(l, "light");
      if (l.id === "building-3d") {
        show(l);
        l.minzoom = 14;
        const paint = paintOf(l);
        paint["fill-extrusion-color"] = "#d9d4cc";
        paint["fill-extrusion-opacity"] = ["interpolate", ["linear"], ["zoom"], 14, 0, 15, 0.85];
      }
    }
    style.sources.esri = esriSource();
    style.sources.terrain = terrainSource();
    style.sources["terrain-shade"] = terrainSource();
    style.sources.night = nightSource();
    style.terrain = { source: "terrain", exaggeration: 1.5 };
    style.sky = { ...SKY, "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 0.85, 4, 0.5, 7, 0.15] } as SkySpecification;
    style.layers = [
      { id: "background", type: "background", paint: { "background-color": "#000000" } },
      satelliteLayer(),
      hillshadeLayer(),
      nightLayer(),
      ...keep,
    ];
    return style as unknown as StyleSpecification;
  }

  if (mode === "satellite") {
    style.sources = { esri: esriSource() };
    style.layers = [
      { id: "background", type: "background", paint: { "background-color": "#000000" } },
      satelliteLayer(),
    ];
    return style as unknown as StyleSpecification;
  }

  if (mode === "hybrid" || theme === "dark") {
    for (const layer of style.layers) darkenVector(layer, mode === "hybrid" ? "light" : "dark");
  }

  if (mode === "hybrid") {
    style.sources.esri = esriSource();
    const backgroundIndex = Math.max(0, style.layers.findIndex((layer) => layer.id === "background"));
    style.layers.splice(backgroundIndex + 1, 0, satelliteLayer());
    for (const layer of style.layers) {
      if (isLandCover(layer.id)) hide(layer);
    }
  }

  if (mode === "3d") {
    style.sources.terrain = terrainSource();
    style.sources["terrain-shade"] = terrainSource();
    style.sources.night = nightSource();
    const at = Math.max(1, style.layers.findIndex((l) => l.id === "background") + 1);
    style.layers.splice(at, 0, hillshadeLayer(), nightLayer());
    style.terrain = { source: "terrain", exaggeration: 1.5 };
    for (const layer of style.layers) {
      if (layer.id === "building") hide(layer);
      if (layer.id === "building-3d") show(layer);
    }
  } else {
    for (const layer of style.layers) {
      if (layer.id === "building") show(layer);
      if (layer.id === "building-3d") hide(layer);
    }
  }

  return style as unknown as StyleSpecification;
}
