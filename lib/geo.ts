const LAT_KM = 110.574;
const LNG_KM = 111.32;

function round(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** Nearest point on a ~1 km grid. Max error is about 0.71 km. */
export function approximateKm(lat: number, lng: number, km = 1) {
  const latStep = km / LAT_KM;
  const latRounded = Math.round(lat / latStep) * latStep;
  const cosine = Math.max(0.05, Math.cos((latRounded * Math.PI) / 180));
  const lngStep = km / (LNG_KM * cosine);
  const lngRounded = Math.round(lng / lngStep) * lngStep;
  return {
    lat: round(latRounded, 5),
    lng: round(lngRounded, 5),
  };
}

export function distanceKm(
  latA: number,
  lngA: number,
  latB: number,
  lngB: number,
) {
  const earth = 6371;
  const dLat = ((latB - latA) * Math.PI) / 180;
  const dLng = ((lngB - lngA) * Math.PI) / 180;
  const a1 = (latA * Math.PI) / 180;
  const a2 = (latB * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a1) * Math.cos(a2) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatCoord(lat: number, lng: number, digits = 4) {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(digits)}° ${ns}, ${Math.abs(lng).toFixed(digits)}° ${ew}`;
}

export function buildShareText(
  title: string,
  lat: number,
  lng: number,
  precise: boolean,
  origin: string,
) {
  const coords = precise ? { lat, lng } : approximateKm(lat, lng);
  const digits = precise ? 5 : 4;
  const label = precise ? "Precise location" : "Approximate location (~1 km)";
  const url = `${origin}/?lat=${coords.lat.toFixed(digits)}&lng=${coords.lng.toFixed(digits)}`;
  return {
    coords,
    text: `${title} · Anorix Globe\n${label}: ${coords.lat.toFixed(digits)}, ${coords.lng.toFixed(digits)}\n${url}`,
  };
}

export function geoErrorMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return "Location is blocked. Allow it in the browser settings, then try again.";
  }
  if (error.code === error.TIMEOUT) {
    return "The location request timed out.";
  }
  return "Location is unavailable on this device.";
}
