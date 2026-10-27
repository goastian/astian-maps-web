import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const monorepoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const tileServerUrl = (
  process.env.ASTIAN_TILE_SERVER_URL ?? "http://127.0.0.1:3001"
).replace(/\/$/, "");

const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: monorepoRoot,
  transpilePackages: [
    "@astian-maps/contracts",
    "@astian-maps/design-tokens",
    "@astian-maps/i18n",
  ],
  async headers() {
    return [
      {
        source: "/calibration.json:sig(\\.sig)?",
        headers: [
          { key: "Cache-Control", value: "public, max-age=300, must-revalidate" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
  async rewrites() {
    const worldGlyphs =
      process.env.ASTIAN_WORLD_TILES === "community" &&
      process.env.NODE_ENV !== "production";
    return {
      beforeFiles: [
        ...(worldGlyphs
          ? [
              {
                // The published Noto ranges are empty beyond Latin, Cyrillic
                // and Greek, so CJK and Arabic would render as boxes. Local
                // worldwide work reads OpenFreeMap's complete glyph set.
                source: "/map-assets/fonts/:path*",
                destination: "https://tiles.openfreemap.org/fonts/:path*",
              },
            ]
          : []),
      ],
      afterFiles: [
        {
          source: "/.well-known/assetlinks.json",
          destination: "/assetlinks",
        },
        {
          source: "/tiles/planet/:path*",
          destination: `${tileServerUrl}/planet/:path*`,
        },
        {
          // Martin publishes tile URLs from the incoming Host header as
          // /planet/{z}/{x}/{y}. Keep that public path reachable through the
          // web origin so browsers and Android emulators never need direct
          // access to Martin's private port.
          source: "/planet/:path*",
          destination: `${tileServerUrl}/planet/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
