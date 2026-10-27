export type AirQualityTone =
  | "good"
  | "moderate"
  | "sensitive"
  | "unhealthy"
  | "very-unhealthy"
  | "hazardous"
  | "unknown";

export interface AirQualityLevel {
  tone: AirQualityTone;
  labelKey:
    | "good"
    | "moderate"
    | "sensitive"
    | "unhealthy"
    | "veryUnhealthy"
    | "hazardous"
    | "unknown";
}

/** Classifies the provider's US AQI value without implying a continuous heatmap. */
export function classifyUsAqi(value?: number): AirQualityLevel {
  if (value === undefined || !Number.isFinite(value) || value < 0) {
    return { tone: "unknown", labelKey: "unknown" };
  }
  if (value <= 50) return { tone: "good", labelKey: "good" };
  if (value <= 100) return { tone: "moderate", labelKey: "moderate" };
  if (value <= 150) return { tone: "sensitive", labelKey: "sensitive" };
  if (value <= 200) return { tone: "unhealthy", labelKey: "unhealthy" };
  if (value <= 300) {
    return { tone: "very-unhealthy", labelKey: "veryUnhealthy" };
  }
  return { tone: "hazardous", labelKey: "hazardous" };
}
