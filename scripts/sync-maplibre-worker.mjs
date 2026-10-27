import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workerSource = createRequire(import.meta.url).resolve(
  "maplibre-gl/dist/maplibre-gl-worker.mjs",
);
const publicRoot = resolve(appRoot, "public/map-assets");

await mkdir(publicRoot, { recursive: true });
await copyFile(workerSource, resolve(publicRoot, "maplibre-gl-worker.mjs"));

console.log("Copied the MapLibre GL worker into the web app.");
