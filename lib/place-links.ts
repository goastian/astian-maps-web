import type { Coordinates, Place } from "@astian-maps/contracts";

const OPENSTREETMAP_BASE_URL = "https://www.openstreetmap.org";
const PANORAMAX_VIEWER_URL = "https://api.panoramax.xyz/";

export interface OpenStreetMapObjectLinks {
  viewUrl: string;
  editUrl: string;
}

export function createOpenStreetMapObjectLinks(
  reference?: Place["osm"],
): OpenStreetMapObjectLinks | undefined {
  if (
    !reference ||
    !["node", "way", "relation"].includes(reference.type) ||
    !Number.isSafeInteger(reference.id) ||
    reference.id <= 0
  ) {
    return undefined;
  }

  const viewUrl = new URL(
    "/" + reference.type + "/" + String(reference.id),
    OPENSTREETMAP_BASE_URL,
  );
  const editUrl = new URL("/edit", OPENSTREETMAP_BASE_URL);
  editUrl.searchParams.set("editor", "id");
  editUrl.searchParams.set(reference.type, String(reference.id));

  return {
    viewUrl: viewUrl.toString(),
    editUrl: editUrl.toString(),
  };
}

export function createPanoramaxMapUrl(
  coordinates: Coordinates,
): string | undefined {
  const { latitude, longitude } = coordinates;
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return undefined;
  }

  const formattedLatitude = normalizeCoordinate(latitude);
  const formattedLongitude = normalizeCoordinate(longitude);
  return (
    PANORAMAX_VIEWER_URL +
    "?focus=map&map=18/" +
    formattedLatitude +
    "/" +
    formattedLongitude
  );
}

function normalizeCoordinate(value: number): string {
  const rounded = Number(value.toFixed(6));
  return Object.is(rounded, -0) ? "0.000000" : rounded.toFixed(6);
}
