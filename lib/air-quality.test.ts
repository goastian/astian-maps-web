import { describe, expect, it } from "vitest";
import { classifyUsAqi } from "./air-quality";

describe("US AQI presentation", () => {
  it.each([
    [0, "good"],
    [50, "good"],
    [51, "moderate"],
    [100, "moderate"],
    [101, "sensitive"],
    [150, "sensitive"],
    [151, "unhealthy"],
    [200, "unhealthy"],
    [201, "very-unhealthy"],
    [300, "very-unhealthy"],
    [301, "hazardous"],
  ] as const)("classifies %i as %s", (value, tone) => {
    expect(classifyUsAqi(value).tone).toBe(tone);
  });

  it("keeps missing or invalid provider values honest", () => {
    expect(classifyUsAqi().tone).toBe("unknown");
    expect(classifyUsAqi(Number.NaN).tone).toBe("unknown");
    expect(classifyUsAqi(-1).tone).toBe("unknown");
  });
});
