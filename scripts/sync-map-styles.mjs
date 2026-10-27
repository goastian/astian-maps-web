import { copyFile, cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const styleRoot = resolve(appRoot, "../../packages/map-style/dist");
const publicRoot = resolve(appRoot, "public/map-styles");
const publicSprites = resolve(appRoot, "public/map-assets/sprites");
const publicFonts = resolve(appRoot, "public/map-assets/fonts");

await mkdir(publicRoot, { recursive: true });
await Promise.all(
  ["light", "dark", "navigation"].map((variant) =>
    copyFile(
      resolve(styleRoot, `${variant}.json`),
      resolve(publicRoot, `${variant}.json`),
    ),
  ),
);
await rm(publicSprites, { recursive: true, force: true });
await cp(resolve(styleRoot, "sprites"), publicSprites, { recursive: true });
await cp(resolve(styleRoot, "fonts"), publicFonts, { recursive: true });

console.log("Copied Astian map styles, sprites and Noto glyphs into the web app.");
