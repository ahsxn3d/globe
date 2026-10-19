import { readFile } from "node:fs/promises";
import path from "node:path";

export async function GET() {
  const file = path.join(process.cwd(), "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs");
  const body = await readFile(file);
  return new Response(body, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
