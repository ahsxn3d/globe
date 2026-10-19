import assert from "node:assert/strict";
import test from "node:test";
import { approximateKm, distanceKm } from "../lib/geo.ts";

test("approximate coordinates stay within about 1 km", () => {
  const samples = [
    [31.588, 74.3108],
    [24.7964, 67.0304],
    [33.7294, 73.0372],
    [35.6812, 139.7671],
    [40.758, -73.9855],
    [-33.8568, 151.2153],
    [64.15, -21.94],
    [0.2, 179.6],
  ];

  for (const [lat, lng] of samples) {
    const approx = approximateKm(lat, lng);
    const drift = distanceKm(lat, lng, approx.lat, approx.lng);
    assert.ok(drift <= 0.75, `${lat},${lng} drifted ${drift} km`);
  }
});
