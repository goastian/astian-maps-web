import { describe, expect, it } from "vitest";
import {
  allMapLayersAvailable,
  parseStoredLayerSelection,
  productionMapLayerAvailability,
  sanitizeMapLayerSelection,
  type MapLayerSelection,
} from "./map-layers";

const evaluationSelection: MapLayerSelection = {
  base: "satellite",
  overlays: {
    cycling: true,
    airQuality: true,
    evChargers: true,
    buildings3d: true,
    traffic: true,
  },
};

describe("web map-layer availability", () => {
  it("degrades unavailable evaluation sources to road and keeps safe overlays", () => {
    expect(
      sanitizeMapLayerSelection(
        evaluationSelection,
        productionMapLayerAvailability,
      ),
    ).toEqual({
      base: "road",
      overlays: {
        cycling: false,
        airQuality: false,
        evChargers: true,
        buildings3d: true,
        traffic: true,
      },
    });
  });

  it("keeps explicitly available development sources", () => {
    expect(
      sanitizeMapLayerSelection(evaluationSelection, allMapLayersAvailable),
    ).toEqual({
      ...evaluationSelection,
      // 3D buildings are not compatible with the raster satellite base.
      overlays: { ...evaluationSelection.overlays, buildings3d: false },
    });
  });

  it("sanitizes persisted preferences before they reach the renderer", () => {
    expect(
      parseStoredLayerSelection(
        JSON.stringify(evaluationSelection),
        productionMapLayerAvailability,
      ),
    ).toEqual({
      base: "road",
      overlays: {
        cycling: false,
        airQuality: false,
        evChargers: true,
        buildings3d: true,
        traffic: true,
      },
    });
  });
});

describe("live-traffic overlay", () => {
  it("is off by default and survives only when the stored choice says so", () => {
    expect(parseStoredLayerSelection(null).overlays.traffic).toBe(false);
    expect(
      parseStoredLayerSelection(
        JSON.stringify({ base: "road", overlays: { traffic: true } }),
        productionMapLayerAvailability,
      ).overlays.traffic,
    ).toBe(true);
    expect(
      parseStoredLayerSelection(
        JSON.stringify({ base: "road", overlays: { traffic: "yes" } }),
        productionMapLayerAvailability,
      ).overlays.traffic,
    ).toBe(false);
  });
});
