import { describe, expect, it } from "vitest";
import { parseMapStart } from "./map-start";

describe("parseMapStart", () => {
  it("reads latitude, longitude and zoom", () => {
    expect(parseMapStart("43.7384, 7.4246, 14")).toEqual({
      latitude: 43.7384,
      longitude: 7.4246,
      zoom: 14,
    });
  });

  it("defaults the zoom and rejects invalid values", () => {
    expect(parseMapStart("10,20")?.zoom).toBe(12);
    expect(parseMapStart(undefined)).toBeUndefined();
    expect(parseMapStart("abc,1")).toBeUndefined();
    expect(parseMapStart("91,0,3")).toBeUndefined();
    expect(parseMapStart("0,181,3")).toBeUndefined();
    expect(parseMapStart("0,0,40")).toBeUndefined();
  });
});
