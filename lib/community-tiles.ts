const INTEGER_SEGMENT = /^(0|[1-9]\d*)$/;
const MVT_SEGMENT = /^(0|[1-9]\d*)\.mvt$/;
const OPENFREEMAP_TEMPLATE_PATH =
  /^\/planet\/[A-Za-z0-9][A-Za-z0-9._-]{0,127}\/\{z\}\/\{x\}\/\{y\}\.(?:pbf|mvt)$/;
const UNSAFE_HOST_CHARACTERS = /[\s/\\?#@]/;

export interface PublicOriginPolicy {
  nodeEnvironment?: string;
  allowedOrigins?: string;
}

export const OURMAP_TILEJSON_UPSTREAM =
  "https://tile.ourmap.us/data/v3.json";
export const OURMAP_TILE_UPSTREAM_ORIGIN =
  "https://dwuxtsziek7cf.cloudfront.net";
export const OPENFREEMAP_TILEJSON_UPSTREAM =
  "https://tiles.openfreemap.org/planet";
export const OPENFREEMAP_TILE_ORIGIN = "https://tiles.openfreemap.org";
export const COMMUNITY_TILE_MAX_ZOOM = 14;
export const COMMUNITY_TILEJSON_MAX_BYTES = 512 * 1024;
export const COMMUNITY_TILE_MAX_BYTES = 5 * 1024 * 1024;
export const COMMUNITY_TILE_ATTRIBUTION = [
  '<a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap contributors</a>',
  '<a href="https://openmaptiles.org/" target="_blank">© OpenMapTiles</a>',
  '<a href="https://tile.ourmap.us/" target="_blank">OurMap community tiles</a>',
  '<a href="https://openfreemap.org/" target="_blank">OpenFreeMap fallback</a>',
].join(" · ");

/**
 * Community tile providers are a deliberate development-only escape hatch.
 * A production Next.js process can never opt in, even if an inherited shell
 * variable accidentally enables the proxy.
 */
export function isCommunityTileProxyEnabled(
  nodeEnvironment = process.env.NODE_ENV,
  explicitOptIn = process.env.ASTIAN_ENABLE_COMMUNITY_TILES,
): boolean {
  return nodeEnvironment !== "production" && explicitOptIn === "true";
}

export interface CommunityTileCoordinate {
  z: number;
  x: number;
  y: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstForwardedValue(value: string | null): string | null {
  const first = value?.split(",", 1)[0].trim();
  return first || null;
}

function parseIntegerSegment(value: string): number | null {
  if (!INTEGER_SEGMENT.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function getPublicRequestOrigin(
  request: Request,
  policy: PublicOriginPolicy = {},
): string {
  const requestUrl = new URL(request.url);
  const forwardedProtocol = firstForwardedValue(
    request.headers.get("x-forwarded-proto"),
  );
  const protocol = forwardedProtocol
    ? `${forwardedProtocol.toLowerCase().replace(/:$/, "")}:`
    : requestUrl.protocol;
  if (protocol !== "http:" && protocol !== "https:") {
    throw new TypeError("The forwarded request protocol is invalid");
  }

  const host =
    firstForwardedValue(request.headers.get("x-forwarded-host")) ??
    request.headers.get("host")?.trim() ??
    requestUrl.host;
  if (
    !host ||
    host.length > 255 ||
    UNSAFE_HOST_CHARACTERS.test(host)
  ) {
    throw new TypeError("The forwarded request host is invalid");
  }

  const publicUrl = new URL(`${protocol}//${host}`);
  if (
    !publicUrl.hostname ||
    publicUrl.username ||
    publicUrl.password ||
    publicUrl.pathname !== "/" ||
    publicUrl.search ||
    publicUrl.hash
  ) {
    throw new TypeError("The forwarded request origin is invalid");
  }

  const publicOrigin = publicUrl.origin;
  const nodeEnvironment = policy.nodeEnvironment ?? process.env.NODE_ENV;
  if (nodeEnvironment === "production") {
    const allowedOrigins = parsePublicOriginAllowlist(
      policy.allowedOrigins ?? process.env.ASTIAN_WEB_PUBLIC_ORIGINS,
    );
    if (!allowedOrigins.has(publicOrigin)) {
      throw new TypeError("The public request origin is not allowed in production");
    }
  }

  return publicOrigin;
}

function parsePublicOriginAllowlist(value: string | undefined): Set<string> {
  const allowedOrigins = new Set<string>();
  for (const candidate of value?.split(",") ?? []) {
    const normalized = candidate.trim();
    if (!normalized) continue;

    let origin: URL;
    try {
      origin = new URL(normalized);
    } catch {
      throw new TypeError("ASTIAN_WEB_PUBLIC_ORIGINS contains an invalid origin");
    }
    if (
      !["http:", "https:"].includes(origin.protocol) ||
      origin.origin !== normalized ||
      origin.username ||
      origin.password
    ) {
      throw new TypeError("ASTIAN_WEB_PUBLIC_ORIGINS must contain exact HTTP(S) origins");
    }
    allowedOrigins.add(origin.origin);
  }

  if (allowedOrigins.size === 0) {
    throw new TypeError("ASTIAN_WEB_PUBLIC_ORIGINS is required in production");
  }
  return allowedOrigins;
}

export function parseCommunityTilePath(
  segments: readonly string[],
): CommunityTileCoordinate | null {
  if (segments.length !== 3) {
    return null;
  }

  const [zSegment, xSegment, yWithExtension] = segments;
  const yMatch = MVT_SEGMENT.exec(yWithExtension);
  if (!yMatch) {
    return null;
  }

  const z = parseIntegerSegment(zSegment);
  const x = parseIntegerSegment(xSegment);
  const y = parseIntegerSegment(yMatch[1]);
  if (z === null || x === null || y === null || z > COMMUNITY_TILE_MAX_ZOOM) {
    return null;
  }

  const maximumCoordinate = 2 ** z - 1;
  if (x > maximumCoordinate || y > maximumCoordinate) {
    return null;
  }

  return { z, x, y };
}

export function getOurMapUpstreamTileUrl({
  z,
  x,
  y,
}: CommunityTileCoordinate): string {
  return `${OURMAP_TILE_UPSTREAM_ORIGIN}/planet/${z}/${x}/${y}.mvt`;
}

export function extractOpenFreeMapTileTemplate(tileJson: unknown): string {
  if (!isRecord(tileJson) || !Array.isArray(tileJson.tiles)) {
    throw new TypeError("The OpenFreeMap TileJSON response is invalid");
  }

  for (const candidate of tileJson.tiles) {
    if (typeof candidate !== "string") {
      continue;
    }

    let url: URL;
    let decodedPathname: string;
    try {
      url = new URL(candidate);
      decodedPathname = decodeURIComponent(url.pathname);
    } catch {
      continue;
    }

    if (
      url.origin === OPENFREEMAP_TILE_ORIGIN &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      OPENFREEMAP_TEMPLATE_PATH.test(decodedPathname)
    ) {
      return candidate;
    }
  }

  throw new TypeError("OpenFreeMap did not publish an allowed tile template");
}

export function getOpenFreeMapUpstreamTileUrl(
  template: string,
  { z, x, y }: CommunityTileCoordinate,
): string {
  // Revalidate at the point of use so a caller can never turn this helper into
  // an arbitrary URL fetch.
  extractOpenFreeMapTileTemplate({ tiles: [template] });
  return template
    .replace("{z}", String(z))
    .replace("{x}", String(x))
    .replace("{y}", String(y));
}

export function rewriteCommunityTileJson(
  upstream: unknown,
  publicOrigin: string,
): Record<string, unknown> {
  if (!isRecord(upstream) || !Array.isArray(upstream.tiles)) {
    throw new TypeError("The community TileJSON response is invalid");
  }

  const origin = new URL(publicOrigin);
  if (
    (origin.protocol !== "http:" && origin.protocol !== "https:") ||
    origin.origin !== publicOrigin
  ) {
    throw new TypeError("The public request origin is invalid");
  }

  return {
    ...upstream,
    attribution: COMMUNITY_TILE_ATTRIBUTION,
    tiles: [`${origin.origin}/tiles/community/{z}/{x}/{y}.mvt`],
    "astian:tile-providers": ["ourmap", "openfreemap-fallback"],
  };
}

export async function readLimitedResponseBody(
  response: Response,
  maximumBytes: number,
): Promise<ArrayBuffer> {
  const declaredLength = response.headers.get("content-length");
  if (
    declaredLength !== null &&
    Number.isFinite(Number(declaredLength)) &&
    Number(declaredLength) > maximumBytes
  ) {
    throw new RangeError("The upstream response is too large");
  }

  if (!response.body) {
    return new ArrayBuffer(0);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      totalBytes += value.byteLength;
      if (totalBytes > maximumBytes) {
        await reader.cancel();
        throw new RangeError("The upstream response is too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const result = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return result.buffer as ArrayBuffer;
}
