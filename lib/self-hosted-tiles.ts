export const SELF_HOSTED_TILEJSON_MAX_BYTES = 1024 * 1024;
export const SELF_HOSTED_TILE_MAX_BYTES = 5 * 1024 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function rewriteSelfHostedTileJson(
  upstream: unknown,
  publicOrigin: string,
): Record<string, unknown> {
  if (!isRecord(upstream)) {
    throw new TypeError("The self-hosted TileJSON response is invalid");
  }
  if (upstream.tilejson !== "3.0.0" && upstream.tilejson !== "2.0.0") {
    throw new TypeError("The self-hosted TileJSON schema version is unsupported");
  }
  if (
    !Array.isArray(upstream.tiles) ||
    upstream.tiles.length === 0 ||
    !upstream.tiles.every((tile) => typeof tile === "string")
  ) {
    throw new TypeError("The self-hosted TileJSON has no tile template");
  }
  if (
    !Array.isArray(upstream.vector_layers) ||
    upstream.vector_layers.length === 0 ||
    !upstream.vector_layers.every(
      (layer) => isRecord(layer) && typeof layer.id === "string" && layer.id.length > 0,
    )
  ) {
    throw new TypeError("The self-hosted TileJSON has no vector layer catalog");
  }
  if (
    !Array.isArray(upstream.bounds) ||
    upstream.bounds.length !== 4 ||
    !upstream.bounds.every((coordinate) =>
      Number.isFinite(typeof coordinate === "number" ? coordinate : Number.NaN),
    ) ||
    Number(upstream.bounds[0]) >= Number(upstream.bounds[2]) ||
    Number(upstream.bounds[1]) >= Number(upstream.bounds[3])
  ) {
    throw new TypeError("The self-hosted TileJSON bounds are invalid");
  }
  if (
    typeof upstream.attribution !== "string" ||
    !upstream.attribution.includes("openstreetmap.org/copyright") ||
    !upstream.attribution.includes("openmaptiles.org")
  ) {
    throw new TypeError("The self-hosted TileJSON attribution is incomplete");
  }

  const origin = new URL(publicOrigin);
  if (
    !["http:", "https:"].includes(origin.protocol) ||
    origin.origin !== publicOrigin ||
    origin.username ||
    origin.password
  ) {
    throw new TypeError("The public tile origin is invalid");
  }

  return {
    ...upstream,
    tiles: [`${origin.origin}/planet/{z}/{x}/{y}`],
  };
}

export async function readLimitedTileResponse(
  response: Response,
  maximumBytes: number,
): Promise<ArrayBuffer> {
  const declaredLength = response.headers.get("content-length");
  if (
    declaredLength !== null &&
    Number.isFinite(Number(declaredLength)) &&
    Number(declaredLength) > maximumBytes
  ) {
    throw new RangeError("The self-hosted tile response is too large");
  }
  const body = await response.arrayBuffer();
  if (body.byteLength > maximumBytes) {
    throw new RangeError("The self-hosted tile response is too large");
  }
  return body;
}
