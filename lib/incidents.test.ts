import { describe, expect, it } from "vitest";
import {
  INCIDENT_COLORS,
  INCIDENT_TYPES,
  MAX_BOX_SPAN,
  boxContains,
  clampBox,
  incidentCopy,
  isExpired,
  minutesSince,
} from "./incidents";

describe("incidents", () => {
  it("names and colors every type in every language", () => {
    for (const locale of ["es", "en", "fr", "de"] as const) {
      const copy = incidentCopy(locale);
      for (const type of INCIDENT_TYPES) expect(copy.types[type]).toBeTruthy();
    }
    for (const type of INCIDENT_TYPES) expect(INCIDENT_COLORS[type]).toHaveLength(2);
  });

  it("clamps a wide view to what the server accepts", () => {
    const [west, south, east, north] = clampBox([-20, -10, 20, 10]);
    expect(east - west).toBeCloseTo(MAX_BOX_SPAN);
    expect(north - south).toBeCloseTo(MAX_BOX_SPAN);
    expect((west + east) / 2).toBeCloseTo(0);
    const grown = clampBox([0, 0, 1, 1], 0.5);
    expect(grown[2] - grown[0]).toBeCloseTo(1.5);
    expect(boxContains(grown, [0, 0, 1, 1])).toBe(true);
    expect(boxContains([0, 0, 1, 1], grown)).toBe(false);
  });

  it("ages and expires reports", () => {
    const now = Date.parse("2026-10-26T12:00:00Z");
    expect(minutesSince("2026-10-26T11:45:30Z", now)).toBe(14);
    const incident = {
      id: "inc_1",
      type: "police" as const,
      coordinates: { latitude: 37.78, longitude: -122.42 },
      createdAt: "2026-10-26T11:00:00Z",
      expiresAt: "2026-10-26T12:00:00Z",
      confidence: 0.5,
      confirmations: 0,
    };
    expect(isExpired(incident, now)).toBe(true);
    expect(isExpired({ ...incident, expiresAt: "2026-10-26T12:30:00Z" }, now)).toBe(false);
    expect(incidentCopy("es").ago(75)).toBe("Hace 1 h");
  });
});
