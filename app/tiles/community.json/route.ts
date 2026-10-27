import {
  COMMUNITY_TILEJSON_MAX_BYTES,
  OPENFREEMAP_TILEJSON_UPSTREAM,
  OURMAP_TILEJSON_UPSTREAM,
  getPublicRequestOrigin,
  isCommunityTileProxyEnabled,
  readLimitedResponseBody,
  rewriteCommunityTileJson,
} from "../../../lib/community-tiles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UPSTREAM_TIMEOUT_MS = 5_000;

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

async function fetchTileJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error("TileJSON provider returned an error");
    }
    const body = await readLimitedResponseBody(
      response,
      COMMUNITY_TILEJSON_MAX_BYTES,
    );
    return JSON.parse(new TextDecoder().decode(body)) as unknown;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: Request): Promise<Response> {
  if (!isCommunityTileProxyEnabled()) {
    return problem(
      404,
      "Community tiles disabled",
      "Community tile providers are available only through an explicit non-production opt-in.",
    );
  }

  let upstreamTileJson: unknown;
  try {
    try {
      upstreamTileJson = await fetchTileJson(OURMAP_TILEJSON_UPSTREAM);
    } catch {
      upstreamTileJson = await fetchTileJson(OPENFREEMAP_TILEJSON_UPSTREAM);
    }

    const localTileJson = rewriteCommunityTileJson(
      upstreamTileJson,
      getPublicRequestOrigin(request),
    );
    return Response.json(localTileJson, {
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return problem(
      502,
      "Community TileJSON unavailable",
      "The community TileJSON could not be fetched or validated.",
    );
  }
}
