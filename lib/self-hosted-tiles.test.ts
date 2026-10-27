import { describe, expect, it } from "vitest";
import {
  readLimitedTileResponse,
  rewriteSelfHostedTileJson,
} from "./self-hosted-tiles";

const tileJson = {
  tilejson: "3.0.0",
  tiles: ["http://martin:3000/planet/{z}/{x}/{y}"],
  vector_layers: [{ id: "water", fields: {} }],
  bounds: [7.4, 43.4, 7.6, 43.8],
  attribution:
    '<a href="https://openmaptiles.org">OpenMapTiles</a> <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
};

describe("self-hosted TileJSON", () => {
  it("rewrites Martin URLs to the browser host", () => {
    expect(
      rewriteSelfHostedTileJson(tileJson, "http://10.0.2.2:3000").tiles,
    ).toEqual(["http://10.0.2.2:3000/planet/{z}/{x}/{y}"]);
  });

  it.each([
    [{ ...tileJson, vector_layers: [] }, "vector layer"],
    [{ ...tileJson, bounds: [7.4, 43.4, 7.3, 43.8] }, "bounds"],
    [{ ...tileJson, attribution: "OpenMapTiles" }, "attribution"],
  ])("rejects incomplete metadata (%s)", (candidate, message) => {
    expect(() =>
      rewriteSelfHostedTileJson(candidate, "http://localhost:3000"),
    ).toThrow(message);
  });

  it("rejects oversized Martin responses", async () => {
    await expect(
      readLimitedTileResponse(new Response("12345"), 4),
    ).rejects.toThrow("too large");
  });
});
