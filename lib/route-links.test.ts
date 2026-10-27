import type { Place } from "@astian-maps/contracts";
import { describe, expect, it } from "vitest";
import {
  allMapLayersAvailable,
  productionMapLayerAvailability,
} from "./map-layers";
import {
  createMobileRouteUrl,
  createRoutePlan,
  createWebRouteUrl,
  parseRoutePlan,
  serializeRoutePlan,
  type ShareableRoutePlan,
} from "./route-links";

const origin = place("origin", "Bogotá Centro", 4.711, -74.0721);
const destination = place("destination", "Aeropuerto El Dorado", 4.7016, -74.1469);

const completePlan: ShareableRoutePlan = {
  origin,
  destination,
  stops: [
    place("stop-1", "Museo Nacional", 4.6156, -74.0684),
    place("stop-2", "Café de O'Connor & Hijos", 4.6501, -74.1012),
  ],
  profile: "cycling",
  avoid: { tolls: true, highways: false, ferries: true },
  preferences: {
    locale: "fr",
    theme: "dark",
    layerSelection: {
      base: "terrain",
      overlays: {
        cycling: true,
        airQuality: true,
        evChargers: false,
        buildings3d: true,
        traffic: false,
      },
    },
    lowData: true,
  },
};

describe("route-link v1 contract", () => {
  it("round-trips a complete route and every portable preference", () => {
    const serialized = serializeRoutePlan(completePlan);
    const parsed = parseRoutePlan(serialized, allMapLayersAvailable);

    expect(serialized.get("v")).toBe("1");
    expect(serialized.getAll("via")).toHaveLength(2);
    expect(parsed).toMatchObject({
      origin: { name: origin.name, coordinates: origin.coordinates },
      destination: {
        name: destination.name,
        coordinates: destination.coordinates,
      },
      stops: completePlan.stops.map((stop) => ({
        name: stop.name,
        coordinates: stop.coordinates,
      })),
      profile: "cycling",
      avoid: { tolls: true, highways: false, ferries: true },
      preferences: completePlan.preferences,
    });
  });

  it("supports zero and exactly eight ordered stops", () => {
    expect(parseRoutePlan(serializeRoutePlan({ ...completePlan, stops: [] }))?.stops)
      .toEqual([]);

    const stops = Array.from({ length: 8 }, (_, index) =>
      place(`stop-${index}`, `Parada ${index + 1}`, 4 + index / 100, -74),
    );
    const parsed = parseRoutePlan(serializeRoutePlan({ ...completePlan, stops }));

    expect(parsed?.stops.map((stop) => stop.name)).toEqual(
      stops.map((stop) => stop.name),
    );
  });

  it("rejects over-limit or partially invalid stop lists", () => {
    const overLimit = serializeRoutePlan({
      ...completePlan,
      stops: Array.from({ length: 8 }, (_, index) =>
        place(`stop-${index}`, `Parada ${index + 1}`, index, index),
      ),
    });
    overLimit.append("via", "1,1");
    overLimit.append("viaName", "Parada 9");
    expect(parseRoutePlan(overLimit)).toBeUndefined();

    const malformed = serializeRoutePlan(completePlan);
    malformed.set("via", "not-a-coordinate");
    expect(parseRoutePlan(malformed)).toBeUndefined();

    expect(() =>
      serializeRoutePlan({
        ...completePlan,
        stops: Array.from({ length: 9 }, (_, index) =>
          place(`stop-${index}`, `Parada ${index + 1}`, index, index),
        ),
      }),
    ).toThrow(/at most 8 stops/);
  });

  it("rejects missing endpoints, unsupported versions and out-of-range coordinates", () => {
    expect(parseRoutePlan("v=1&from=4,-74")).toBeUndefined();
    expect(
      parseRoutePlan("v=2&from=4,-74&to=5,-75"),
    ).toBeUndefined();
    expect(
      parseRoutePlan("v=1&from=91,-74&to=5,-75"),
    ).toBeUndefined();
    expect(parseRoutePlan("v=1&from=,-74&to=5,-75")).toBeUndefined();
    expect(
      parseRoutePlan(`v=1&from=4,-74&to=5,-75&padding=${"x".repeat(12_000)}`),
    ).toBeUndefined();
  });

  it("loads legacy links with safe defaults", () => {
    const parsed = parseRoutePlan(
      "from=4.711,-74.0721&fromName=Origen&to=4.7,-74.1&toName=Destino&mode=walking&avoid=highways",
    );

    expect(parsed).toMatchObject({
      profile: "walking",
      avoid: { tolls: false, highways: true, ferries: false },
      preferences: {
        locale: "es",
        theme: "light",
        layerSelection: {
          base: "road",
          overlays: {
            cycling: false,
            airQuality: false,
            evChargers: true,
            buildings3d: false,
          },
        },
        lowData: false,
      },
    });
  });

  it("normalizes unsupported preferences without accepting unknown flags", () => {
    const params = serializeRoutePlan(completePlan);
    params.set("mode", "flight");
    params.set("lang", "xx");
    params.set("theme", "neon");
    params.set("base", "proprietary");
    params.set("avoid", "tolls,unknown");
    params.set("layers", "cycling,unknown");

    expect(parseRoutePlan(params, allMapLayersAvailable)).toMatchObject({
      profile: "driving",
      avoid: { tolls: true, highways: false, ferries: false },
      preferences: {
        locale: "es",
        theme: "light",
        layerSelection: {
          base: "road",
          overlays: {
            cycling: true,
            airQuality: false,
            evChargers: false,
            buildings3d: false,
          },
        },
      },
    });
  });

  it("produces a canonical HTTPS App Link and matching custom deep link", () => {
    const webUrl = new URL(createWebRouteUrl(completePlan, "https://maps.example/path"));
    const mobileUrl = new URL(createMobileRouteUrl(completePlan));

    expect(webUrl.origin).toBe("https://maps.example");
    expect(webUrl.pathname).toBe("/route");
    expect(mobileUrl.protocol).toBe("astianmaps:");
    expect(mobileUrl.host).toBe("route");
    expect(mobileUrl.search).toBe(webUrl.search);
  });

  it("fails closed when a shared link requests unavailable evaluation layers", () => {
    expect(
      parseRoutePlan(
        serializeRoutePlan(completePlan),
        productionMapLayerAvailability,
      ),
    ).toMatchObject({
      preferences: {
        layerSelection: {
          base: "road",
          overlays: {
            cycling: false,
            airQuality: false,
            evChargers: false,
            buildings3d: true,
          },
        },
      },
    });
  });

  it("never creates a plan with a pending stop", () => {
    expect(
      createRoutePlan({ ...completePlan, stops: [completePlan.stops[0], undefined] }),
    ).toBeUndefined();
  });

  it("sanitizes control characters and caps labels", () => {
    const params = serializeRoutePlan({
      ...completePlan,
      origin: { ...origin, name: `\u0000  Origen\n${"x".repeat(400)}` },
    });
    const name = params.get("fromName") ?? "";

    expect(name).not.toMatch(/[\u0000-\u001f]/);
    expect(name.length).toBe(256);
  });

  it("refuses to serialize invalid coordinates", () => {
    expect(() =>
      serializeRoutePlan({
        ...completePlan,
        origin: { ...origin, coordinates: { latitude: Number.NaN, longitude: 0 } },
      }),
    ).toThrow(/valid WGS84/);
  });
});

function place(
  id: string,
  name: string,
  latitude: number,
  longitude: number,
): Place {
  return {
    id,
    source: "openstreetmap",
    name,
    category: { id: "place", label: "Place" },
    coordinates: { latitude, longitude },
    attribution: ["© OpenStreetMap contributors"],
  };
}
