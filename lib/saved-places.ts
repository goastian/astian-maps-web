import type { Place } from "@astian-maps/contracts";

export const SAVED_PLACES_STORAGE_KEY = "astian-saved-places";
export const SAVED_PLACES_SCHEMA_VERSION = 1 as const;

export interface SavedPlacesSnapshot {
  version: typeof SAVED_PLACES_SCHEMA_VERSION;
  places: Place[];
  /**
   * IDs from the former string-array format that cannot be restored as Places.
   * They remain here until a real Place with the same ID is saved or removed.
   */
  unresolvedLegacyIds: string[];
}

export interface SavedPlacesInput {
  places: readonly Place[];
  unresolvedLegacyIds?: readonly string[];
}

/** Parse saved places without depending on window or localStorage. */
export function deserializeSavedPlaces(
  value: string | null | undefined,
): SavedPlacesSnapshot {
  if (!value) return createSavedPlacesSnapshot();

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return createSavedPlacesSnapshot();
  }

  // The web app formerly persisted only an array of Place IDs. Keep those IDs
  // resolvable without fabricating names, coordinates, or other Place fields.
  if (Array.isArray(parsed)) {
    return createSavedPlacesSnapshot([], parsed.filter(isNonEmptyString));
  }

  if (!isRecord(parsed) || parsed.version !== SAVED_PLACES_SCHEMA_VERSION) {
    return createSavedPlacesSnapshot();
  }

  return createSavedPlacesSnapshot(
    Array.isArray(parsed.places) ? parsed.places.filter(isPlace) : [],
    Array.isArray(parsed.unresolvedLegacyIds)
      ? parsed.unresolvedLegacyIds.filter(isNonEmptyString)
      : [],
  );
}

/** Serialize only the current, normalized schema. */
export function serializeSavedPlaces(value: SavedPlacesInput): string {
  return JSON.stringify(
    createSavedPlacesSnapshot(
      value.places,
      value.unresolvedLegacyIds ?? [],
    ),
  );
}

/** Add or refresh a Place and resolve a matching legacy ID, if present. */
export function upsertSavedPlace(
  snapshot: SavedPlacesInput,
  place: Place,
): SavedPlacesSnapshot {
  return createSavedPlacesSnapshot(
    [...snapshot.places, place],
    snapshot.unresolvedLegacyIds ?? [],
  );
}

/** Remove both a fully restored Place and any unresolved legacy reference. */
export function removeSavedPlace(
  snapshot: SavedPlacesInput,
  placeId: string,
): SavedPlacesSnapshot {
  return createSavedPlacesSnapshot(
    snapshot.places.filter((place) => place.id !== placeId),
    (snapshot.unresolvedLegacyIds ?? []).filter((id) => id !== placeId),
  );
}

export function getSavedPlaceIds(snapshot: SavedPlacesInput): Set<string> {
  return new Set([
    ...snapshot.places.map((place) => place.id),
    ...(snapshot.unresolvedLegacyIds ?? []),
  ]);
}

function createSavedPlacesSnapshot(
  places: readonly Place[] = [],
  unresolvedLegacyIds: readonly string[] = [],
): SavedPlacesSnapshot {
  const placesById = new Map<string, Place>();
  for (const place of places) {
    if (isPlace(place)) placesById.set(place.id, place);
  }

  const normalizedPlaces = [...placesById.values()];
  const resolvedIds = new Set(placesById.keys());
  const normalizedLegacyIds = [...new Set(unresolvedLegacyIds)]
    .filter(isNonEmptyString)
    .filter((id) => !resolvedIds.has(id));

  return {
    version: SAVED_PLACES_SCHEMA_VERSION,
    places: normalizedPlaces,
    unresolvedLegacyIds: normalizedLegacyIds,
  };
}

function isPlace(value: unknown): value is Place {
  if (!isRecord(value)) return false;

  return (
    isNonEmptyString(value.id) &&
    value.source === "openstreetmap" &&
    typeof value.name === "string" &&
    isCategory(value.category) &&
    isCoordinates(value.coordinates) &&
    isOptionalOsmReference(value.osm) &&
    isOptionalAddress(value.address) &&
    isOptionalString(value.openingHours) &&
    isOptionalString(value.phone) &&
    isOptionalString(value.website) &&
    isOptionalWheelchair(value.wheelchair) &&
    isOptionalString(value.wikidataId) &&
    (value.distanceMeters === undefined ||
      (typeof value.distanceMeters === "number" &&
        Number.isFinite(value.distanceMeters) &&
        value.distanceMeters >= 0)) &&
    Array.isArray(value.attribution) &&
    value.attribution.every((item) => typeof item === "string")
  );
}

function isCategory(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    typeof value.label === "string" &&
    isOptionalString(value.icon)
  );
}

function isCoordinates(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.latitude === "number" &&
    Number.isFinite(value.latitude) &&
    value.latitude >= -90 &&
    value.latitude <= 90 &&
    typeof value.longitude === "number" &&
    Number.isFinite(value.longitude) &&
    value.longitude >= -180 &&
    value.longitude <= 180
  );
}

function isOptionalOsmReference(value: unknown): boolean {
  if (value === undefined) return true;
  return (
    isRecord(value) &&
    (value.type === "node" ||
      value.type === "way" ||
      value.type === "relation") &&
    typeof value.id === "number" &&
    Number.isSafeInteger(value.id) &&
    value.id > 0
  );
}

function isOptionalAddress(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value) || typeof value.formatted !== "string") return false;

  return [
    value.houseNumber,
    value.road,
    value.neighbourhood,
    value.city,
    value.state,
    value.postcode,
    value.country,
    value.countryCode,
  ].every(isOptionalString);
}

function isOptionalWheelchair(value: unknown): boolean {
  return (
    value === undefined ||
    value === "yes" ||
    value === "limited" ||
    value === "no" ||
    value === "unknown"
  );
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
