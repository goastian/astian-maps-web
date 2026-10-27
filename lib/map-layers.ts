export const MAP_BASE_LAYERS = ["road", "satellite", "terrain"] as const;

export type MapBaseLayer = (typeof MAP_BASE_LAYERS)[number];

export interface MapOverlaySelection {
  cycling: boolean;
  airQuality: boolean;
  evChargers: boolean;
  buildings3d: boolean;
  traffic: boolean;
}

export interface MapLayerSelection {
  base: MapBaseLayer;
  overlays: MapOverlaySelection;
}

export interface MapLayerAvailability {
  base: Record<MapBaseLayer, boolean>;
  overlays: Record<keyof MapOverlaySelection, boolean>;
}

/**
 * External evaluation sources are deliberately unavailable in production.
 * Development still requires an explicit opt-in and an explicit URL for each
 * tile-backed source, so a build can never silently fall back to a community
 * or non-commercial provider.
 */
export const evaluationMapLayersEnabled =
  process.env.NODE_ENV !== "production" &&
  process.env.NEXT_PUBLIC_ENABLE_EVALUATION_LAYERS === "true";

export const productionMapLayerAvailability: MapLayerAvailability = {
  base: { road: true, satellite: false, terrain: false },
  overlays: {
    cycling: false,
    airQuality: false,
    evChargers: true,
    buildings3d: true,
    traffic: true,
  },
};

export const runtimeMapLayerAvailability: MapLayerAvailability = {
  base: {
    road: true,
    satellite:
      evaluationMapLayersEnabled &&
      Boolean(process.env.NEXT_PUBLIC_SATELLITE_TILE_URL) &&
      Boolean(process.env.NEXT_PUBLIC_SATELLITE_LABEL_TILE_URL),
    terrain:
      evaluationMapLayersEnabled &&
      Boolean(process.env.NEXT_PUBLIC_TERRAIN_DEM_TILE_URL),
  },
  overlays: {
    cycling:
      evaluationMapLayersEnabled &&
      Boolean(process.env.NEXT_PUBLIC_CYCLING_TILE_URL),
    airQuality: evaluationMapLayersEnabled,
    evChargers: true,
    buildings3d: true,
    traffic: true,
  },
};

export const allMapLayersAvailable: MapLayerAvailability = {
  base: { road: true, satellite: true, terrain: true },
  overlays: {
    cycling: true,
    airQuality: true,
    evChargers: true,
    buildings3d: true,
    traffic: true,
  },
};

export const defaultMapLayerSelection: MapLayerSelection = {
  base: "road",
  overlays: {
    cycling: false,
    airQuality: false,
    evChargers: true,
    buildings3d: false,
    traffic: false,
  },
};

export function sanitizeMapLayerSelection(
  selection: MapLayerSelection,
  availability: MapLayerAvailability = runtimeMapLayerAvailability,
): MapLayerSelection {
  const base = availability.base[selection.base] ? selection.base : "road";
  return {
    base,
    overlays: {
      cycling:
        availability.overlays.cycling && selection.overlays.cycling,
      airQuality:
        availability.overlays.airQuality && selection.overlays.airQuality,
      evChargers:
        availability.overlays.evChargers && selection.overlays.evChargers,
      buildings3d:
        availability.overlays.buildings3d &&
        base !== "satellite" &&
        selection.overlays.buildings3d,
      traffic: availability.overlays.traffic && selection.overlays.traffic,
    },
  };
}

export function parseStoredLayerSelection(
  value: string | null,
  availability: MapLayerAvailability = runtimeMapLayerAvailability,
): MapLayerSelection {
  if (!value) return defaultMapLayerSelection;
  try {
    const parsed = JSON.parse(value) as Partial<MapLayerSelection>;
    const base = MAP_BASE_LAYERS.includes(parsed.base as MapBaseLayer)
      ? (parsed.base as MapBaseLayer)
      : defaultMapLayerSelection.base;
    const overlays: Partial<MapOverlaySelection> = parsed.overlays ?? {};
    return sanitizeMapLayerSelection({
      base,
      overlays: {
        cycling: overlays.cycling === true,
        airQuality: overlays.airQuality === true,
        evChargers: overlays.evChargers !== false,
        buildings3d: overlays.buildings3d === true,
        traffic: overlays.traffic === true,
      },
    }, availability);
  } catch {
    return defaultMapLayerSelection;
  }
}
