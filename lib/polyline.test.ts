import { describe, expect, it } from "vitest";
import { decodePolyline, encodePolyline } from "./polyline";

describe("polyline6", () => {
  it("round trips coordinates at six decimal places", () => {
    const points = [
      { latitude: 48.860611, longitude: 2.337644 },
      { latitude: 48.85837, longitude: 2.294481 },
      { latitude: 48.8567, longitude: 2.3508 },
    ];
    expect(decodePolyline(encodePolyline(points))).toEqual(points);
  });

  it("rejects truncated values", () => {
    expect(() => decodePolyline("~")).toThrow("Invalid encoded polyline");
  });
});
