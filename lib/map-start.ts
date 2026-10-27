export interface MapStart {
  latitude: number;
  longitude: number;
  zoom: number;
}

export function parseMapStart(value: string | undefined): MapStart | undefined {
  if (!value) return undefined;
  const [latitude, longitude, zoom = 12] = value.split(",").map((part) => Number(part.trim()));
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(zoom) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180 ||
    zoom < 0 ||
    zoom > 22
  ) {
    return undefined;
  }
  return { latitude, longitude, zoom };
}

export const configuredMapStart = parseMapStart(process.env.NEXT_PUBLIC_MAP_START);
