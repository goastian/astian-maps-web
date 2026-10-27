import {
  COMMUNITY_TILEJSON_MAX_BYTES,
  COMMUNITY_TILE_MAX_BYTES,
  OPENFREEMAP_TILEJSON_UPSTREAM,
  extractOpenFreeMapTileTemplate,
  getOpenFreeMapUpstreamTileUrl,
  getOurMapUpstreamTileUrl,
  isCommunityTileProxyEnabled,
  parseCommunityTilePath,
  readLimitedResponseBody,
  type CommunityTileCoordinate,
} from "../../../../lib/community-tiles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UPSTREAM_TIMEOUT_MS = 10_000;
const TILE_ATTEMPTS = 2;
const TEMPLATE_CACHE_MS = 5 * 60 * 1_000;
const SAFE_CONTENT_TYPES = new Set([
  "application/octet-stream",
  "application/vnd.mapbox-vector-tile",
  "application/x-protobuf",
]);

interface RouteContext {
  params: Promise<{ tile: string[] }>;
}

interface TileResult {
  body: ArrayBuffer;
  provider: "ourmap" | "openfreemap";
  response: Response;
}

let openFreeMapTemplateCache:
  | { expiresAt: number; template: string }
  | undefined;

function problem(status: number, title: string, detail: string): Response {
  return Response.json(
    { type: "about:blank", title, status, detail },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/problem+json",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

async function fetchWithTimeout(url: string, accept: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    return await fetch(url, {
      cache: "no-store",
      headers: { Accept: accept },
      redirect: "error",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function getOpenFreeMapTemplate(): Promise<string> {
  if (
    openFreeMapTemplateCache &&
    openFreeMapTemplateCache.expiresAt > Date.now()
  ) {
    return openFreeMapTemplateCache.template;
  }

  const response = await fetchWithTimeout(
    OPENFREEMAP_TILEJSON_UPSTREAM,
    "application/json",
  );
  if (!response.ok) {
    throw new Error("OpenFreeMap TileJSON is unavailable");
  }
  const body = await readLimitedResponseBody(
    response,
    COMMUNITY_TILEJSON_MAX_BYTES,
  );
  const template = extractOpenFreeMapTileTemplate(
    JSON.parse(new TextDecoder().decode(body)) as unknown,
  );
  openFreeMapTemplateCache = {
    expiresAt: Date.now() + TEMPLATE_CACHE_MS,
    template,
  };
  return template;
}

async function tryTile(
  url: string,
  provider: TileResult["provider"],
): Promise<TileResult | null> {
  for (let attempt = 0; attempt < TILE_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchWithTimeout(
        url,
        "application/vnd.mapbox-vector-tile, application/x-protobuf, application/octet-stream",
      );
      if (response.status === 404 || response.status === 204) {
        return null;
      }
      if (!response.ok) {
        continue;
      }
      const body = await readLimitedResponseBody(response, COMMUNITY_TILE_MAX_BYTES);
      return { body, provider, response };
    } catch {
      continue;
    }
  }
  return null;
}

async function resolveTile(
  coordinate: CommunityTileCoordinate,
): Promise<TileResult | null> {
  const preferred = await tryTile(
    getOurMapUpstreamTileUrl(coordinate),
    "ourmap",
  );
  if (preferred) {
    return preferred;
  }

  try {
    const template = await getOpenFreeMapTemplate();
    return await tryTile(
      getOpenFreeMapUpstreamTileUrl(template, coordinate),
      "openfreemap",
    );
  } catch {
    return null;
  }
}

export async function GET(
  _request: Request,
  { params }: RouteContext,
): Promise<Response> {
  if (!isCommunityTileProxyEnabled()) {
    return problem(
      404,
      "Community tiles disabled",
      "Community tile providers are available only through an explicit non-production opt-in.",
    );
  }

  const { tile } = await params;
  const coordinate = parseCommunityTilePath(tile);
  if (!coordinate) {
    return problem(
      400,
      "Invalid tile coordinate",
      "Use /tiles/community/{z}/{x}/{y}.mvt with canonical XYZ coordinates between zoom 0 and 14.",
    );
  }

  const result = await resolveTile(coordinate);
  if (!result) {
    return problem(
      502,
      "Community tile unavailable",
      "Neither the preferred OurMap provider nor the OpenFreeMap fallback returned this tile.",
    );
  }

  const upstreamContentType = result.response.headers
    .get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();
  const headers = new Headers({
    "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    "Content-Type":
      upstreamContentType && SAFE_CONTENT_TYPES.has(upstreamContentType)
        ? upstreamContentType
        : "application/vnd.mapbox-vector-tile",
    "X-Astian-Tile-Provider": result.provider,
    "X-Content-Type-Options": "nosniff",
  });
  for (const header of ["etag", "last-modified"] as const) {
    const value = result.response.headers.get(header);
    if (value) {
      headers.set(header, value);
    }
  }

  return new Response(result.body, { status: 200, headers });
}
