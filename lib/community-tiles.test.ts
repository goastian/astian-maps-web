import { describe, expect, it } from "vitest";
import {
  COMMUNITY_TILE_ATTRIBUTION,
  extractOpenFreeMapTileTemplate,
  getOpenFreeMapUpstreamTileUrl,
  getOurMapUpstreamTileUrl,
  getPublicRequestOrigin,
  isCommunityTileProxyEnabled,
  parseCommunityTilePath,
  readLimitedResponseBody,
  rewriteCommunityTileJson,
} from "./community-tiles";

describe("community tile development proxy", () => {
  it("requires an explicit non-production opt-in and cannot run in production", () => {
    expect(isCommunityTileProxyEnabled("development", undefined)).toBe(false);
    expect(isCommunityTileProxyEnabled("development", "true")).toBe(true);
    expect(isCommunityTileProxyEnabled("test", "true")).toBe(true);
    expect(isCommunityTileProxyEnabled("production", "true")).toBe(false);
  });

  it("uses the Host header instead of an unusable bind address", () => {
    const request = new Request(
      "http://0.0.0.0:3000/tiles/community.json",
      { headers: { host: "127.0.0.1:3000" } },
    );

    expect(getPublicRequestOrigin(request)).toBe("http://127.0.0.1:3000");
  });

  it("uses validated forwarded host and protocol for an Android emulator", () => {
    const request = new Request(
      "http://0.0.0.0:3000/tiles/community.json",
      {
        headers: {
          host: "0.0.0.0:3000",
          "x-forwarded-host": "10.0.2.2:3000",
          "x-forwarded-proto": "http",
        },
      },
    );

    expect(getPublicRequestOrigin(request)).toBe("http://10.0.2.2:3000");
  });

  it("rejects unsafe forwarded hosts", () => {
    const request = new Request(
      "http://0.0.0.0:3000/tiles/community.json",
      { headers: { "x-forwarded-host": "example.test/path" } },
    );

    expect(() => getPublicRequestOrigin(request)).toThrow("host is invalid");
  });

  it("allows only explicitly configured public origins in production", () => {
    const localhost = new Request(
      "http://0.0.0.0:3000/tiles/planet.json",
      { headers: { host: "localhost:3000" } },
    );
    const emulator = new Request(
      "http://0.0.0.0:3000/tiles/planet.json",
      {
        headers: {
          host: "0.0.0.0:3000",
          "x-forwarded-host": "10.0.2.2:3000",
          "x-forwarded-proto": "http",
        },
      },
    );
    const policy = {
      nodeEnvironment: "production",
      allowedOrigins:
        "http://localhost:3000,http://127.0.0.1:3000,http://10.0.2.2:3000",
    };

    expect(getPublicRequestOrigin(localhost, policy)).toBe(
      "http://localhost:3000",
    );
    expect(getPublicRequestOrigin(emulator, policy)).toBe(
      "http://10.0.2.2:3000",
    );
  });

  it("rejects an otherwise valid forwarded host outside the production allowlist", () => {
    const request = new Request(
      "http://0.0.0.0:3000/tiles/planet.json",
      {
        headers: {
          "x-forwarded-host": "attacker.example:3000",
          "x-forwarded-proto": "https",
        },
      },
    );

    expect(() =>
      getPublicRequestOrigin(request, {
        nodeEnvironment: "production",
        allowedOrigins: "http://localhost:3000",
      }),
    ).toThrow("not allowed in production");
  });

  it("fails closed when the production origin allowlist is missing or malformed", () => {
    const request = new Request(
      "http://0.0.0.0:3000/tiles/planet.json",
      { headers: { host: "localhost:3000" } },
    );

    expect(() =>
      getPublicRequestOrigin(request, {
        nodeEnvironment: "production",
        allowedOrigins: "",
      }),
    ).toThrow("required in production");
    expect(() =>
      getPublicRequestOrigin(request, {
        nodeEnvironment: "production",
        allowedOrigins: "http://localhost:3000/path",
      }),
    ).toThrow("exact HTTP(S) origins");
  });

  it("rewrites TileJSON to same-origin tiles with complete attribution", () => {
    const upstream = {
      tilejson: "2.0.0",
      name: "OpenMapTiles",
      tiles: ["https://upstream.invalid/{z}/{x}/{y}.mvt"],
      vector_layers: [{ id: "water" }],
    };

    const rewritten = rewriteCommunityTileJson(
      upstream,
      "http://10.0.2.2:3000",
    );
    expect(rewritten.tiles).toEqual([
      "http://10.0.2.2:3000/tiles/community/{z}/{x}/{y}.mvt",
    ]);
    expect(rewritten.attribution).toBe(COMMUNITY_TILE_ATTRIBUTION);
    expect(rewritten["astian:tile-providers"]).toEqual([
      "ourmap",
      "openfreemap-fallback",
    ]);
    expect(upstream.tiles).toEqual([
      "https://upstream.invalid/{z}/{x}/{y}.mvt",
    ]);
  });

  it("keeps OurMap first and resolves an allowed versioned OpenFreeMap template", () => {
    const coordinate = parseCommunityTilePath(["14", "8529", "5974.mvt"]);
    const template = extractOpenFreeMapTileTemplate({
      tiles: [
        "https://tiles.openfreemap.org/planet/20260621_080001_pt/{z}/{x}/{y}.pbf",
      ],
    });

    expect(coordinate).toEqual({ z: 14, x: 8529, y: 5974 });
    expect(getOurMapUpstreamTileUrl(coordinate!)).toBe(
      "https://dwuxtsziek7cf.cloudfront.net/planet/14/8529/5974.mvt",
    );
    expect(getOpenFreeMapUpstreamTileUrl(template, coordinate!)).toBe(
      "https://tiles.openfreemap.org/planet/20260621_080001_pt/14/8529/5974.pbf",
    );
  });

  it.each([
    "https://attacker.test/planet/version/{z}/{x}/{y}.pbf",
    "https://tiles.openfreemap.org/other/version/{z}/{x}/{y}.pbf",
    "https://tiles.openfreemap.org/planet/{z}/{x}/{y}.pbf",
    "http://tiles.openfreemap.org/planet/version/{z}/{x}/{y}.pbf",
  ])("rejects an unapproved OpenFreeMap template: %s", (template) => {
    expect(() => extractOpenFreeMapTileTemplate({ tiles: [template] })).toThrow(
      "allowed tile template",
    );
  });

  it.each([
    [["15", "0", "0.mvt"], "zoom above the upstream maximum"],
    [["3", "8", "0.mvt"], "x outside the zoom extent"],
    [["3", "0", "8.mvt"], "y outside the zoom extent"],
    [["3", "01", "0.mvt"], "non-canonical integer"],
    [["3", "0", "0.png"], "wrong extension"],
    [["3", "0", "..", "0.mvt"], "extra or traversal segment"],
  ])("rejects %s (%s)", (segments) => {
    expect(parseCommunityTilePath(segments)).toBeNull();
  });

  it("stops reading an oversized upstream body", async () => {
    const response = new Response("12345");

    await expect(readLimitedResponseBody(response, 4)).rejects.toThrow(
      "too large",
    );
  });
});
