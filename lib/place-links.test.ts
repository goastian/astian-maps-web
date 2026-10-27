import { describe, expect, it } from "vitest";
import {
  createOpenStreetMapObjectLinks,
  createPanoramaxMapUrl,
} from "./place-links";

describe("open place links", () => {
  it.each(["node", "way", "relation"] as const)(
    "builds view and iD edit links for an OSM %s",
    (type) => {
      expect(createOpenStreetMapObjectLinks({ type, id: 123 })).toEqual({
        viewUrl: "https://www.openstreetmap.org/" + type + "/123",
        editUrl:
          "https://www.openstreetmap.org/edit?editor=id&" + type + "=123",
      });
    },
  );

  it("does not expose an object link without a valid OSM reference", () => {
    expect(createOpenStreetMapObjectLinks()).toBeUndefined();
    expect(
      createOpenStreetMapObjectLinks({ type: "node", id: 0 }),
    ).toBeUndefined();
    expect(
      createOpenStreetMapObjectLinks({ type: "way", id: Number.NaN }),
    ).toBeUndefined();
  });

  it("centers the documented Panoramax viewer on place coordinates", () => {
    expect(
      createPanoramaxMapUrl({
        latitude: 48.8566,
        longitude: 2.3522,
      }),
    ).toBe(
      "https://api.panoramax.xyz/?focus=map&map=18/48.856600/2.352200",
    );
  });

  it("does not expose Panoramax for invalid coordinates", () => {
    expect(
      createPanoramaxMapUrl({ latitude: 91, longitude: 2.3522 }),
    ).toBeUndefined();
    expect(
      createPanoramaxMapUrl({
        latitude: 48.8566,
        longitude: Number.POSITIVE_INFINITY,
      }),
    ).toBeUndefined();
  });
});
