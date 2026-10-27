import type { StyleSpecification } from "maplibre-gl";
import { describe, expect, it } from "vitest";
import { createMapStyle, resolveStyleAssetUrls } from "./map-style";

describe("evaluation map sources", () => {
  it("falls back to the road style when satellite URLs are unavailable", () => {
    expect(createMapStyle("dark", undefined, "satellite", {})).toBe(
      "/map-styles/dark.json",
    );
  });

  it("uses satellite imagery only when both development URLs are explicit", () => {
    const style = createMapStyle("light", undefined, "satellite", {
      satelliteTileUrl: "https://evaluation.example/imagery/{z}/{x}/{y}.jpg",
      satelliteLabelTileUrl:
        "https://evaluation.example/labels/{z}/{x}/{y}.png",
    }) as StyleSpecification;

    expect(style.sources["astian-satellite"]).toMatchObject({
      tiles: ["https://evaluation.example/imagery/{z}/{x}/{y}.jpg"],
    });
    expect(style.sources["astian-satellite-labels"]).toMatchObject({
      tiles: ["https://evaluation.example/labels/{z}/{x}/{y}.png"],
    });
  });
});

describe("resolveStyleAssetUrls", () => {
  const base: StyleSpecification = { version: 8, sources: {}, layers: [] };

  it("makes a relative sprite URL absolute", () => {
    const style = resolveStyleAssetUrls(
      { ...base, sprite: "/map-assets/sprites/astian" },
      "https://maps.example",
    );
    expect(style.sprite).toBe("https://maps.example/map-assets/sprites/astian");
  });

  it("keeps absolute sprite URLs and resolves every entry of a sprite list", () => {
    const style = resolveStyleAssetUrls(
      {
        ...base,
        sprite: [
          { id: "default", url: "/sprites/a" },
          { id: "extra", url: "https://cdn.example/sprites/b" },
        ],
      },
      "https://maps.example",
    );
    expect(style.sprite).toEqual([
      { id: "default", url: "https://maps.example/sprites/a" },
      { id: "extra", url: "https://cdn.example/sprites/b" },
    ]);
  });

  it("leaves styles without a sprite untouched", () => {
    expect(resolveStyleAssetUrls(base, "https://maps.example")).toBe(base);
  });
});
