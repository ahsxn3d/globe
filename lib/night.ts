import { addProtocol } from "maplibre-gl";

/**
 * Real-time day/night for the globe. Each tile is NASA's Black Marble (VIIRS,
 * via NASA GIBS) masked per pixel by the actual Sun position, so city lights
 * appear only on the night side with a soft civil/nautical twilight band.
 */
const GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8";
const D2R = Math.PI / 180;

/** Subsolar point (deg) from NOAA's low-precision solar formulas. */
export function subsolar(date = new Date()) {
  const jd = date.getTime() / 86_400_000 + 2440587.5;
  const n = jd - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * D2R;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * D2R;
  const eps = (23.439 - 0.0000004 * n) * D2R;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const gmst = (280.46061837 + 360.98564736629 * n) % 360;
  let lng = (ra / D2R - gmst) % 360;
  if (lng > 180) lng -= 360;
  if (lng < -180) lng += 360;
  return { lat: dec / D2R, lng };
}

export function nightTileUrl() {
  // Ten-minute buckets keep the terminator current while letting tiles cache.
  return `night://{z}/{x}/{y}?t=${Math.floor(Date.now() / 600_000)}`;
}

let registered = false;
export function registerNightProtocol() {
  if (registered || typeof window === "undefined") return;
  registered = true;
  addProtocol("night", async (params, abort) => {
    const m = /night:\/\/(\d+)\/(\d+)\/(\d+)\?t=(\d+)/.exec(params.url);
    if (!m) throw new Error("bad night url");
    const [z, x, y, t] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
    const sun = subsolar(new Date(t * 600_000 + 300_000));
    const res = await fetch(`${GIBS}/${z}/${y}/${x}.png`, { signal: abort.signal });
    if (!res.ok) throw new Error("night tile failed");
    const bmp = await createImageBitmap(await res.blob());
    const S = 256;
    const canvas = new OffscreenCanvas(S, S);
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(bmp, 0, 0, S, S);
    const img = ctx.getImageData(0, 0, S, S);
    const d = img.data;
    const sd = Math.sin(sun.lat * D2R);
    const cd = Math.cos(sun.lat * D2R);
    const tiles = 2 ** z;
    for (let py = 0; py < S; py += 1) {
      const my = Math.PI * (1 - (2 * (y + (py + 0.5) / S)) / tiles);
      const lat = Math.atan(Math.sinh(my));
      const sl = Math.sin(lat);
      const cl = Math.cos(lat);
      for (let px = 0; px < S; px += 1) {
        const lng = ((x + (px + 0.5) / S) / tiles) * 360 - 180;
        const sinAlt = sl * sd + cl * cd * Math.cos((lng - sun.lng) * D2R);
        // 0 in daylight, 1 once the Sun is ~9 degrees below the horizon.
        let k = (0.05 - sinAlt) / 0.2;
        k = k < 0 ? 0 : k > 1 ? 1 : k * k * (3 - 2 * k);
        const i = (py * S + px) * 4;
        const lum = (d[i] + d[i + 1] + d[i + 2]) / 765;
        d[i + 3] = Math.round(255 * k * Math.min(1, 0.86 + lum * 0.6));
      }
    }
    ctx.putImageData(img, 0, 0);
    const blob = await canvas.convertToBlob({ type: "image/png" });
    return { data: await blob.arrayBuffer() };
  });
}
