import type { Coordinates } from "@astian-maps/contracts";

export function decodePolyline(
  encoded: string,
  precision = 6,
): Coordinates[] {
  const factor = 10 ** precision;
  const points: Coordinates[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    const latitudeValue = decodeValue(encoded, index);
    index = latitudeValue.nextIndex;
    latitude += latitudeValue.delta;

    const longitudeValue = decodeValue(encoded, index);
    index = longitudeValue.nextIndex;
    longitude += longitudeValue.delta;

    points.push({
      latitude: latitude / factor,
      longitude: longitude / factor,
    });
  }

  return points;
}

export function encodePolyline(points: Coordinates[], precision = 6): string {
  const factor = 10 ** precision;
  let previousLatitude = 0;
  let previousLongitude = 0;
  let output = "";

  for (const point of points) {
    const latitude = Math.round(point.latitude * factor);
    const longitude = Math.round(point.longitude * factor);
    output += encodeValue(latitude - previousLatitude);
    output += encodeValue(longitude - previousLongitude);
    previousLatitude = latitude;
    previousLongitude = longitude;
  }

  return output;
}

function decodeValue(encoded: string, startIndex: number) {
  let index = startIndex;
  let result = 0;
  let shift = 0;
  let byte: number;

  do {
    if (index >= encoded.length) {
      throw new Error("Invalid encoded polyline");
    }
    byte = encoded.charCodeAt(index++) - 63;
    result |= (byte & 0x1f) << shift;
    shift += 5;
  } while (byte >= 0x20);

  return {
    delta: result & 1 ? ~(result >> 1) : result >> 1,
    nextIndex: index,
  };
}

function encodeValue(value: number): string {
  let shifted = value < 0 ? ~(value << 1) : value << 1;
  let output = "";
  while (shifted >= 0x20) {
    output += String.fromCharCode((0x20 | (shifted & 0x1f)) + 63);
    shifted >>= 5;
  }
  return output + String.fromCharCode(shifted + 63);
}
