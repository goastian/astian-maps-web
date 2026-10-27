import type { StyleSpecification } from "maplibre-gl";
import type { MapBaseLayer } from "./map-layers";
import { runtimeMapLayerAvailability } from "./map-layers";

export type MapTheme = "light" | "dark";

/**
 * MapLibre GL 6 rejects relative sprite URLs, while the Astian styles are
 * served with same-origin paths so they work behind any public host.
 */
export function resolveStyleAssetUrls(
  style: StyleSpecification,
  origin: string,
): StyleSpecification {
  const absolute = (url: string) => new URL(url, origin).href;
  const { sprite } = style;
  if (!sprite) return style;
  return {
    ...style,
    sprite:
      typeof sprite === "string"
        ? absolute(sprite)
        : sprite.map((entry) => ({ ...entry, url: absolute(entry.url) })),
  };
}

export interface EvaluationMapLayerSources {
  satelliteTileUrl?: string;
  satelliteLabelTileUrl?: string;
  satelliteLabelAttribution?: string;
  terrainDemTileUrl?: string;
  cyclingTileUrl?: string;
}

export const runtimeEvaluationMapLayerSources: EvaluationMapLayerSources = {
  satelliteTileUrl: runtimeMapLayerAvailability.base.satellite
    ? process.env.NEXT_PUBLIC_SATELLITE_TILE_URL
    : undefined,
  satelliteLabelTileUrl: runtimeMapLayerAvailability.base.satellite
    ? process.env.NEXT_PUBLIC_SATELLITE_LABEL_TILE_URL
    : undefined,
  satelliteLabelAttribution: process.env.NEXT_PUBLIC_SATELLITE_LABEL_ATTRIBUTION,
  terrainDemTileUrl: runtimeMapLayerAvailability.base.terrain
    ? process.env.NEXT_PUBLIC_TERRAIN_DEM_TILE_URL
    : undefined,
  cyclingTileUrl: runtimeMapLayerAvailability.overlays.cycling
    ? process.env.NEXT_PUBLIC_CYCLING_TILE_URL
    : undefined,
};

/**
 * Production uses the Astian styles built by @astian/map-style. The
 * optional URL can contain a {theme} placeholder for light and dark variants.
 */
export function createMapStyle(
  theme: MapTheme,
  runtimeStyleUrl?: string,
  baseLayer: MapBaseLayer = "road",
  evaluationSources: EvaluationMapLayerSources = runtimeEvaluationMapLayerSources,
): StyleSpecification | string {
  if (
    baseLayer === "satellite" &&
    evaluationSources.satelliteTileUrl &&
    evaluationSources.satelliteLabelTileUrl
  ) {
    return createSatelliteStyle(
      evaluationSources.satelliteTileUrl,
      evaluationSources.satelliteLabelTileUrl,
      evaluationSources.satelliteLabelAttribution,
    );
  }

  const configured = process.env.NEXT_PUBLIC_MAP_STYLE_URL || runtimeStyleUrl;
  if (configured) {
    return configured
      .replace("{theme}", theme)
      .replace(/(light|dark|navigation)(?=\.json(?:\?|$))/, theme);
  }
  return `/map-styles/${theme}.json`;
}

function createSatelliteStyle(
  satelliteTileUrl: string,
  satelliteLabelTileUrl: string,
  satelliteLabelAttribution?: string,
): StyleSpecification {
  return {
    version: 8,
    name: "Astian Open Imagery",
    sources: {
      "astian-satellite": {
        type: "raster",
        tiles: [satelliteTileUrl],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 14,
        attribution:
          '<a href="https://cloudless.eox.at/">EOxCloudless</a> by EOX · Contains modified Copernicus Sentinel data 2025',
      },
      "astian-satellite-labels": {
        type: "raster",
        tiles: [satelliteLabelTileUrl],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 17,
        attribution:
          satelliteLabelAttribution ||
          '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>',
      },
    },
    layers: [
      {
        id: "astian-satellite-background",
        type: "background",
        paint: { "background-color": "#13231f" },
      },
      {
        id: "astian-satellite-imagery",
        type: "raster",
        source: "astian-satellite",
        paint: {
          "raster-fade-duration": 180,
          "raster-saturation": -0.08,
          "raster-contrast": 0.08,
        },
      },
      {
        id: "astian-satellite-labels",
        type: "raster",
        source: "astian-satellite-labels",
        paint: { "raster-opacity": 0.92 },
      },
    ],
  };
}
