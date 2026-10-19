export type GeoResult = {
  id: string;
  name: string;
  detail: string;
  lat: number;
  lng: number;
  zoom: number;
  kind: string;
  source: "photon" | "nominatim" | "geonames";
};

const KIND_ZOOM: Record<string, number> = {
  continent: 3,
  country: 4.6,
  state: 6.4,
  region: 6.4,
  province: 6.4,
  county: 8.5,
  district: 9.5,
  municipality: 10.5,
  city: 11.2,
  town: 12.6,
  village: 14,
  hamlet: 14.6,
  suburb: 14,
  quarter: 14.5,
  neighbourhood: 15,
  locality: 14.5,
  street: 16.2,
  road: 16.2,
  house: 17.6,
  building: 17.4,
  poi: 17,
};

/** Map zoom for a geocoding hit, preferring its bounding box when it has one. */
export function zoomFor(kind: string, bbox?: [number, number, number, number] | null) {
  const typed = KIND_ZOOM[kind] ?? 16.5;
  if (bbox) {
    const [west, south, east, north] = bbox;
    const span = Math.max(Math.abs(east - west), Math.abs(north - south) * 1.4, 0.0005);
    const fitted = Math.log2(360 / span) - 0.9;
    // A POI with a huge bbox (e.g. a whole park) should not zoom too far out.
    return clamp(fitted, Math.max(2.5, typed - 2.2), Math.min(18, typed + 2));
  }
  return clamp(typed, 2.5, 18);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
