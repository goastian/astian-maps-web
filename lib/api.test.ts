import type {
  AirQualitySnapshot,
  Place,
  RouteResponse,
} from "@astian-maps/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  calculateRoutes,
  getAirQuality,
  isConnectivityError,
  nearbyPlaces,
  reverseGeocode,
  searchPlaces,
  AstianApiError,
} from "./api";

const place: Place = {
  id: "osm:node:1",
  source: "openstreetmap",
  osm: { type: "node", id: 1 },
  name: "Global Coffee",
  category: { id: "cafe", label: "Café" },
  coordinates: { latitude: 4.711, longitude: -74.0721 },
  address: { formatted: "Bogotá, Colombia" },
  attribution: ["OpenStreetMap contributors"],
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Astian Maps live web API", () => {
  it("distinguishes recoverable connectivity failures from invalid requests", () => {
    expect(isConnectivityError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isConnectivityError(new AstianApiError("Gateway timeout", 504))).toBe(true);
    expect(isConnectivityError(new AstianApiError("Invalid route", 422))).toBe(false);
  });

  it("biases a global search to the visible map center", async () => {
    const fetchMock = mockJson({ query: "coffee", items: [place], tookMs: 8 });

    const response = await searchPlaces("coffee", "es", {
      latitude: 4.7,
      longitude: -74.1,
    });

    expect(response).toEqual({ data: [place], source: "live" });
    const requestedUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(requestedUrl).toContain("/v1/search?");
    expect(requestedUrl).toContain("q=coffee");
    expect(requestedUrl).toContain("focus_lat=4.7");
    expect(requestedUrl).toContain("focus_lon=-74.1");
  });

  it("uses a smaller result budget when low-data mode is active", async () => {
    const fetchMock = mockJson({ query: "coffee", items: [place], tookMs: 8 });

    await searchPlaces(
      "coffee",
      "es",
      { latitude: 4.7, longitude: -74.1 },
      { lowData: true },
    );

    const requestedUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(requestedUrl).toContain("limit=6");
  });

  it("reverse geocodes an arbitrary map point", async () => {
    const fetchMock = mockJson(place);

    await expect(reverseGeocode(4.711, -74.0721, "es")).resolves.toEqual({
      data: place,
      source: "live",
    });

    const requestedUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(requestedUrl).toContain("/v1/reverse?");
    expect(requestedUrl).toContain("lat=4.711");
    expect(requestedUrl).toContain("lon=-74.0721");
  });

  it("loads real businesses near the visible map center", async () => {
    const fetchMock = mockJson({ query: "restaurant", items: [place], tookMs: 5 });

    await expect(
      nearbyPlaces("restaurant", "es", {
        latitude: 4.711,
        longitude: -74.0721,
      }),
    ).resolves.toEqual({ data: [place], source: "live" });

    const requestedUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(requestedUrl).toContain("/v1/nearby?");
    expect(requestedUrl).toContain("category=restaurant");
    expect(requestedUrl).toContain("radius_km=8");
  });

  it("reduces nearby radius and result count in low-data mode", async () => {
    const fetchMock = mockJson({ query: "restaurant", items: [place], tookMs: 5 });

    await nearbyPlaces(
      "restaurant",
      "es",
      { latitude: 4.711, longitude: -74.0721 },
      { lowData: true },
    );

    const requestedUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(requestedUrl).toContain("limit=8");
    expect(requestedUrl).toContain("radius_km=5");
  });

  it("loads an attributed modelled air-quality reading at the map center", async () => {
    const snapshot: AirQualitySnapshot = {
      coordinates: { latitude: 4.711, longitude: -74.0721 },
      observedAt: "2026-07-19T18:00:00Z",
      usAqi: 42,
      pm25: 8.4,
      provider: "open-meteo",
      attribution: [
        {
          label: "Open-Meteo / CAMS",
          url: "https://open-meteo.com/en/docs/air-quality-api",
          license: "CC-BY-4.0",
        },
      ],
    };
    const fetchMock = mockJson(snapshot);

    await expect(
      getAirQuality({ latitude: 4.711, longitude: -74.0721 }),
    ).resolves.toEqual({ data: snapshot, source: "live" });

    const requestedUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(requestedUrl).toContain("/v1/air-quality?");
    expect(requestedUrl).toContain("lat=4.711");
    expect(requestedUrl).toContain("lon=-74.0721");
  });

  it("returns only route geometry supplied by the routing backend", async () => {
    const routeResponse: RouteResponse = {
      routes: [],
      dataUpdatedAt: "2026-07-19T00:00:00Z",
    };
    const fetchMock = mockJson(routeResponse);

    const response = await calculateRoutes({
      profile: "driving",
      waypoints: [
        { coordinates: { latitude: 4.711, longitude: -74.0721 } },
        { coordinates: { latitude: 40.7128, longitude: -74.006 } },
      ],
    });

    expect(response).toEqual({ data: routeResponse, source: "live" });
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
  });

  it("surfaces provider errors instead of drawing a fabricated fallback", async () => {
    vi.stubGlobal("window", globalThis);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            type: "about:blank",
            title: "Provider unavailable",
            status: 502,
            code: "provider_unavailable",
          }),
          { status: 502, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(searchPlaces("coffee", "en")).rejects.toMatchObject({
      status: 502,
      code: "provider_unavailable",
    });
  });
});

function mockJson(payload: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("window", globalThis);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
