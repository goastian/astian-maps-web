import type {
  AirQualitySnapshot,
  AppConfig,
  Place,
  PlaceEnrichment,
  RouteRequest,
  RouteResponse,
  SearchResponse,
  SupportedLocale,
} from "@astian-maps/contracts";
import { isProblemDetails } from "@astian-maps/contracts";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/v1";

export type DataSource = "live" | "offline";

export interface Sourced<T> {
  data: T;
  source: DataSource;
}

export interface SearchFocus {
  latitude: number;
  longitude: number;
}

export interface DataRequestOptions {
  lowData?: boolean;
}

export class AstianApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "AstianApiError";
  }
}

export function isConnectivityError(error: unknown): boolean {
  return (
    !(error instanceof AstianApiError) ||
    error.status === undefined ||
    error.status >= 500
  );
}

export function getConfig(): Promise<AppConfig> {
  return request<AppConfig>("/config");
}

export async function searchPlaces(
  query: string,
  locale: SupportedLocale,
  focus?: SearchFocus,
  options: DataRequestOptions = {},
): Promise<Sourced<Place[]>> {
  const params = new URLSearchParams({
    q: query,
    lang: locale,
    limit: options.lowData ? "6" : "12",
  });
  if (focus) {
    params.set("focus_lat", String(focus.latitude));
    params.set("focus_lon", String(focus.longitude));
  }
  const response = await request<SearchResponse>(`/search?${params}`);
  return { data: response.items, source: "live" };
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
  locale: SupportedLocale,
): Promise<Sourced<Place>> {
  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    lang: locale,
  });
  return { data: await request<Place>(`/reverse?${params}`), source: "live" };
}

export async function nearbyPlaces(
  category: string,
  locale: SupportedLocale,
  focus: SearchFocus,
  options: DataRequestOptions = {},
): Promise<Sourced<Place[]>> {
  const params = new URLSearchParams({
    lat: String(focus.latitude),
    lon: String(focus.longitude),
    category,
    lang: locale,
    limit: options.lowData ? "8" : "20",
    radius_km: options.lowData ? "5" : "8",
  });
  const response = await request<SearchResponse>(`/nearby?${params}`);
  return { data: response.items, source: "live" };
}

export async function getAirQuality(
  focus: SearchFocus,
): Promise<Sourced<AirQualitySnapshot>> {
  const params = new URLSearchParams({
    lat: String(focus.latitude),
    lon: String(focus.longitude),
  });
  return {
    data: await request<AirQualitySnapshot>(`/air-quality?${params}`),
    source: "live",
  };
}

export async function getPlaceEnrichment(
  place: Pick<Place, "name" | "coordinates">,
  locale: SupportedLocale,
): Promise<PlaceEnrichment | undefined> {
  const params = new URLSearchParams({
    name: place.name,
    lat: String(place.coordinates.latitude),
    lon: String(place.coordinates.longitude),
    lang: locale,
  });
  try {
    return await request<PlaceEnrichment>(`/places/enrichment?${params}`, {}, 12_000);
  } catch (error) {
    if (error instanceof AstianApiError && error.status !== undefined && error.status < 500) {
      return undefined;
    }
    throw error;
  }
}

/** MapLibre tile template of the API's live-traffic proxy. */
export function trafficTileTemplate(): string {
  return `${apiBaseUrl}/traffic/tiles/{z}/{x}/{y}`;
}

export function resolveApiAsset(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const origin = apiBaseUrl.replace(/\/v1\/?$/, "");
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function calculateRoutes(
  payload: RouteRequest,
): Promise<Sourced<RouteResponse>> {
  return {
    data: await request<RouteResponse>("/routes", {
      method: "POST",
      body: JSON.stringify(payload),
    }, 30_000),
    source: "live",
  };
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = 15_000,
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...init.headers,
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      const errorBody: unknown = await response.json().catch(() => undefined);
      if (isProblemDetails(errorBody)) {
        throw new AstianApiError(
          errorBody.detail ?? errorBody.title,
          errorBody.status,
          errorBody.code,
        );
      }
      throw new AstianApiError(`API request failed with ${response.status}`, response.status);
    }
    return (await response.json()) as T;
  } finally {
    window.clearTimeout(timeout);
  }
}
