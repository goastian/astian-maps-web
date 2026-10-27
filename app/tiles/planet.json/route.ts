import {
  getPublicRequestOrigin,
  isCommunityTileProxyEnabled,
} from "../../../lib/community-tiles";
import { GET as getCommunityTileJson } from "../community.json/route";
import {
  SELF_HOSTED_TILEJSON_MAX_BYTES,
  readLimitedTileResponse,
  rewriteSelfHostedTileJson,
} from "../../../lib/self-hosted-tiles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UPSTREAM_TIMEOUT_MS = 3_000;

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

export async function GET(request: Request): Promise<Response> {
  // Local worldwide coverage: the style keeps asking for /tiles/planet.json and
  // gets the community planet instead of the regional Martin extract. This is
  // a development opt-in; a production process can never take this branch.
  if (
    process.env.ASTIAN_WORLD_TILES === "community" &&
    isCommunityTileProxyEnabled()
  ) {
    return getCommunityTileJson(request);
  }

  const configured = process.env.ASTIAN_TILE_SERVER_URL ?? "http://127.0.0.1:3001";
  let upstream: URL;
  try {
    upstream = new URL("/planet", configured);
    if (!["http:", "https:"].includes(upstream.protocol)) {
      throw new TypeError("unsupported protocol");
    }
  } catch {
    return problem(503, "Self-hosted tiles unavailable", "The Martin origin is invalid.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch(upstream, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error("Martin returned an error");
    }
    const bytes = await readLimitedTileResponse(
      response,
      SELF_HOSTED_TILEJSON_MAX_BYTES,
    );
    const tileJson = rewriteSelfHostedTileJson(
      JSON.parse(new TextDecoder().decode(bytes)) as unknown,
      getPublicRequestOrigin(request),
    );
    return Response.json(tileJson, {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return problem(
      503,
      "Self-hosted tiles unavailable",
      "The local Martin TileJSON could not be fetched or validated.",
    );
  } finally {
    clearTimeout(timeout);
  }
}
