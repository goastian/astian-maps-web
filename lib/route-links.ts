import type {
  Place,
  RouteAvoidance,
  RouteProfile,
  SupportedLocale,
} from "@astian-maps/contracts";
import {
  defaultMapLayerSelection,
  MAP_BASE_LAYERS,
  runtimeMapLayerAvailability,
  sanitizeMapLayerSelection,
  type MapLayerAvailability,
  type MapLayerSelection,
} from "./map-layers";
import type { MapTheme } from "./map-style";

export const ROUTE_LINK_VERSION = "1";
export const MAX_ROUTE_STOPS = 8;
export const MAX_ROUTE_LINK_LENGTH = 12_000;
export const DEFAULT_MAPS_WEB_ORIGIN = "https://maps.astian.org";

const ROUTE_PROFILES: readonly RouteProfile[] = [
  "driving",
  "cycling",
  "walking",
];
const SUPPORTED_LOCALES: readonly SupportedLocale[] = ["es", "en", "fr", "de"];
const AVOIDANCE_KEYS: readonly (keyof RouteAvoidance)[] = [
  "tolls",
  "highways",
  "ferries",
];
const OVERLAY_QUERY_NAMES = {
  cycling: "cycling",
  airQuality: "air-quality",
  evChargers: "ev-chargers",
  buildings3d: "buildings-3d",
} as const satisfies Record<Exclude<keyof MapLayerSelection["overlays"], "traffic">, string>;
const DECIMAL_COORDINATE = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/;

export interface RouteLinkPreferences {
  locale: SupportedLocale;
  theme: MapTheme;
  layerSelection: MapLayerSelection;
  lowData: boolean;
}

export interface ShareableRoutePlan {
  origin: Place;
  destination: Place;
  stops: Place[];
  profile: RouteProfile;
  avoid: RouteAvoidance;
  preferences: RouteLinkPreferences;
}

/**
 * Serializes the complete, portable route state. Parameter names are shared
 * with Android and form the versioned v1 deep-link contract.
 */
export function serializeRoutePlan(plan: ShareableRoutePlan): URLSearchParams {
  if (plan.stops.length > MAX_ROUTE_STOPS) {
    throw new RangeError(`Route links support at most ${MAX_ROUTE_STOPS} stops`);
  }
  const params = new URLSearchParams();
  params.set("v", ROUTE_LINK_VERSION);
  appendPlace(params, "from", "fromName", plan.origin);
  appendPlace(params, "to", "toName", plan.destination);
  plan.stops.forEach((stop) => {
    appendPlace(params, "via", "viaName", stop);
  });
  params.set("mode", normalizeProfile(plan.profile));

  const avoided = AVOIDANCE_KEYS.filter((key) => plan.avoid[key]);
  if (avoided.length > 0) params.set("avoid", avoided.join(","));

  params.set("lang", normalizeLocale(plan.preferences.locale));
  params.set("theme", plan.preferences.theme === "dark" ? "dark" : "light");
  params.set(
    "base",
    MAP_BASE_LAYERS.includes(plan.preferences.layerSelection.base)
      ? plan.preferences.layerSelection.base
      : defaultMapLayerSelection.base,
  );
  const overlays = Object.entries(OVERLAY_QUERY_NAMES)
    .filter(([key]) => plan.preferences.layerSelection.overlays[
      key as keyof MapLayerSelection["overlays"]
    ])
    .map(([, queryName]) => queryName);
  // Keep an explicit empty value so a receiver can distinguish "no overlays"
  // from legacy links where the preference did not exist.
  params.set("layers", overlays.join(","));
  if (plan.preferences.lowData) params.set("lowData", "1");
  return params;
}

/** Accepts both canonical v1 links and the unversioned v0.1 query format. */
export function parseRoutePlan(
  input: URL | URLSearchParams | string,
  layerAvailability: MapLayerAvailability = runtimeMapLayerAvailability,
): ShareableRoutePlan | undefined {
  if (routeLinkLength(input) > MAX_ROUTE_LINK_LENGTH) return undefined;
  const params = toSearchParams(input);
  const version = params.get("v");
  if (version !== null && version !== ROUTE_LINK_VERSION) return undefined;

  const origin = decodePlace(params.get("from"), params.get("fromName"), "from");
  const destination = decodePlace(params.get("to"), params.get("toName"), "to");
  if (!origin || !destination) return undefined;

  const rawStops = params.getAll("via");
  if (rawStops.length > MAX_ROUTE_STOPS) return undefined;
  const stopNames = params.getAll("viaName");
  const stops = rawStops.map((value, index) =>
    decodePlace(value, stopNames[index] ?? null, `via-${index}`),
  );
  if (stops.some((stop) => stop === undefined)) return undefined;

  const avoided = new Set(params.get("avoid")?.split(",") ?? []);
  const layers = new Set(params.get("layers")?.split(",") ?? []);
  const requestedBase = params.get("base");

  return {
    origin,
    destination,
    stops: stops as Place[],
    profile: normalizeProfile(params.get("mode")),
    avoid: {
      tolls: avoided.has("tolls"),
      highways: avoided.has("highways"),
      ferries: avoided.has("ferries"),
    },
    preferences: {
      locale: normalizeLocale(params.get("lang")),
      theme: params.get("theme") === "dark" ? "dark" : "light",
      layerSelection: sanitizeMapLayerSelection({
        base: MAP_BASE_LAYERS.includes(
          requestedBase as (typeof MAP_BASE_LAYERS)[number],
        )
          ? (requestedBase as (typeof MAP_BASE_LAYERS)[number])
          : defaultMapLayerSelection.base,
        overlays: params.has("layers")
          ? {
              cycling: layers.has(OVERLAY_QUERY_NAMES.cycling),
              airQuality: layers.has(OVERLAY_QUERY_NAMES.airQuality),
              evChargers: layers.has(OVERLAY_QUERY_NAMES.evChargers),
              buildings3d: layers.has(OVERLAY_QUERY_NAMES.buildings3d),
              traffic: false,
            }
          : { ...defaultMapLayerSelection.overlays },
      }, layerAvailability),
      lowData: params.get("lowData") === "1",
    },
  };
}

export function createWebRouteUrl(
  plan: ShareableRoutePlan,
  origin = DEFAULT_MAPS_WEB_ORIGIN,
): string {
  const url = new URL("/route", normalizeWebOrigin(origin));
  url.search = serializeRoutePlan(plan).toString();
  return url.toString();
}

export function createMobileRouteUrl(plan: ShareableRoutePlan): string {
  return `astianmaps://route?${serializeRoutePlan(plan).toString()}`;
}

export function createRoutePlan(
  input: Omit<ShareableRoutePlan, "stops"> & {
    stops: Array<Place | undefined>;
  },
): ShareableRoutePlan | undefined {
  if (input.stops.length > MAX_ROUTE_STOPS || input.stops.some((stop) => !stop)) {
    return undefined;
  }
  return { ...input, stops: input.stops as Place[] };
}

function appendPlace(
  params: URLSearchParams,
  coordinateKey: "from" | "to" | "via",
  nameKey: "fromName" | "toName" | "viaName",
  place: Place,
) {
  params.append(coordinateKey, encodeCoordinates(place));
  params.append(nameKey, sanitizeName(place.name));
}

function encodeCoordinates(place: Place): string {
  const { latitude, longitude } = place.coordinates;
  if (!isValidCoordinate(latitude, longitude)) {
    throw new TypeError("Route links require valid WGS84 coordinates");
  }
  return `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
}

function decodePlace(
  value: string | null,
  name: string | null,
  slot: string,
): Place | undefined {
  if (!value || value.length > 64) return undefined;
  const pieces = value.split(",");
  if (pieces.length !== 2) return undefined;
  if (pieces.some((piece) => !DECIMAL_COORDINATE.test(piece.trim()))) {
    return undefined;
  }
  const latitude = Number(pieces[0]);
  const longitude = Number(pieces[1]);
  if (!isValidCoordinate(latitude, longitude)) return undefined;

  const normalizedName = sanitizeName(name ?? "");
  const fallbackName = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  return {
    id: `shared:${slot}:${latitude}:${longitude}`,
    source: "openstreetmap",
    name: normalizedName || fallbackName,
    category: { id: "shared-point", label: "Shared point" },
    coordinates: { latitude, longitude },
    attribution: ["© OpenStreetMap contributors"],
  };
}

function sanitizeName(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 256);
}

function isValidCoordinate(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function normalizeProfile(value: unknown): RouteProfile {
  return ROUTE_PROFILES.includes(value as RouteProfile)
    ? (value as RouteProfile)
    : "driving";
}

function normalizeLocale(value: unknown): SupportedLocale {
  return SUPPORTED_LOCALES.includes(value as SupportedLocale)
    ? (value as SupportedLocale)
    : "es";
}

function normalizeWebOrigin(value: string): string {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.origin
      : DEFAULT_MAPS_WEB_ORIGIN;
  } catch {
    return DEFAULT_MAPS_WEB_ORIGIN;
  }
}

function toSearchParams(input: URL | URLSearchParams | string): URLSearchParams {
  if (input instanceof URLSearchParams) return new URLSearchParams(input);
  if (input instanceof URL) return new URLSearchParams(input.search);
  const queryStart = input.indexOf("?");
  return new URLSearchParams(queryStart >= 0 ? input.slice(queryStart + 1) : input);
}

function routeLinkLength(input: URL | URLSearchParams | string): number {
  if (input instanceof URLSearchParams) return input.toString().length;
  if (input instanceof URL) return input.href.length;
  return input.length;
}
