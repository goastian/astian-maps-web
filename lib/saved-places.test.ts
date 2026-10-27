import type { Place } from "@astian-maps/contracts";
import { describe, expect, it } from "vitest";
import {
  deserializeSavedPlaces,
  getSavedPlaceIds,
  removeSavedPlace,
  SAVED_PLACES_SCHEMA_VERSION,
  serializeSavedPlaces,
  upsertSavedPlace,
} from "./saved-places";

const louvre: Place = {
  id: "osm:way:5013364",
  source: "openstreetmap",
  osm: { type: "way", id: 5_013_364 },
  name: "Musée du Louvre",
  category: { id: "museum", label: "Museum" },
  coordinates: { latitude: 48.8606, longitude: 2.3376 },
  address: { formatted: "Rue de Rivoli, Paris" },
  website: "https://www.louvre.fr",
  wheelchair: "yes",
  attribution: ["OpenStreetMap contributors"],
};

const park: Place = {
  id: "osm:relation:1376161",
  source: "openstreetmap",
  name: "Jardin des Tuileries",
  category: { id: "park", label: "Park" },
  coordinates: { latitude: 48.8635, longitude: 2.3275 },
  attribution: ["OpenStreetMap contributors"],
};

describe("saved places storage", () => {
  it("round-trips complete Places in a versioned payload", () => {
    const serialized = serializeSavedPlaces({ places: [louvre, park] });

    expect(JSON.parse(serialized)).toEqual({
      version: SAVED_PLACES_SCHEMA_VERSION,
      places: [louvre, park],
      unresolvedLegacyIds: [],
    });
    expect(deserializeSavedPlaces(serialized)).toEqual({
      version: SAVED_PLACES_SCHEMA_VERSION,
      places: [louvre, park],
      unresolvedLegacyIds: [],
    });
  });

  it("returns an empty current snapshot for missing, corrupt, or unknown data", () => {
    const empty = {
      version: SAVED_PLACES_SCHEMA_VERSION,
      places: [],
      unresolvedLegacyIds: [],
    };

    expect(deserializeSavedPlaces(null)).toEqual(empty);
    expect(deserializeSavedPlaces("not-json")).toEqual(empty);
    expect(deserializeSavedPlaces(JSON.stringify({ places: [louvre] }))).toEqual(
      empty,
    );
    expect(
      deserializeSavedPlaces(
        JSON.stringify({ version: 2, places: [louvre] }),
      ),
    ).toEqual(empty);
  });

  it("keeps valid entries while discarding malformed Places", () => {
    const invalidPlace = {
      ...park,
      coordinates: { latitude: 200, longitude: 2.3275 },
    };

    expect(
      deserializeSavedPlaces(
        JSON.stringify({
          version: SAVED_PLACES_SCHEMA_VERSION,
          places: [invalidPlace, louvre, null],
          unresolvedLegacyIds: [42, "", "still-unresolved"],
        }),
      ),
    ).toEqual({
      version: SAVED_PLACES_SCHEMA_VERSION,
      places: [louvre],
      unresolvedLegacyIds: ["still-unresolved"],
    });
  });

  it("deduplicates by ID and keeps the newest Place data", () => {
    const refreshedLouvre = { ...louvre, name: "Louvre Museum" };
    const parsed = deserializeSavedPlaces(
      JSON.stringify({
        version: SAVED_PLACES_SCHEMA_VERSION,
        places: [louvre, park, refreshedLouvre],
        unresolvedLegacyIds: [louvre.id, "legacy:one", "legacy:one"],
      }),
    );

    expect(parsed.places).toEqual([refreshedLouvre, park]);
    expect(parsed.unresolvedLegacyIds).toEqual(["legacy:one"]);
  });

  it("migrates the legacy ID array without inventing Place objects", () => {
    const parsed = deserializeSavedPlaces(
      JSON.stringify([louvre.id, louvre.id, "legacy:missing", null]),
    );

    expect(parsed).toEqual({
      version: SAVED_PLACES_SCHEMA_VERSION,
      places: [],
      unresolvedLegacyIds: [louvre.id, "legacy:missing"],
    });
    expect(deserializeSavedPlaces(serializeSavedPlaces(parsed))).toEqual(parsed);
  });

  it("resolves legacy IDs only when a real Place becomes available", () => {
    const legacy = deserializeSavedPlaces(JSON.stringify([louvre.id, park.id]));
    const withLouvre = upsertSavedPlace(legacy, louvre);

    expect(withLouvre.places).toEqual([louvre]);
    expect(withLouvre.unresolvedLegacyIds).toEqual([park.id]);
    expect(getSavedPlaceIds(withLouvre)).toEqual(new Set([louvre.id, park.id]));

    expect(removeSavedPlace(withLouvre, park.id)).toEqual({
      version: SAVED_PLACES_SCHEMA_VERSION,
      places: [louvre],
      unresolvedLegacyIds: [],
    });
  });
});
