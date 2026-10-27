import { copyFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(appRoot, "../android/calibration.json");
const target = resolve(appRoot, "public/calibration.json");

await mkdir(dirname(target), { recursive: true });
await copyFile(source, target);
if (existsSync(`${source}.sig`)) {
  await copyFile(`${source}.sig`, `${target}.sig`);
} else {
  await rm(`${target}.sig`, { force: true });
}

console.log("Published calibration.json for web and Android clients.");
