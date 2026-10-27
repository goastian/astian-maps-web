import {
  createAndroidAssetLinks,
  parseSha256Fingerprints,
} from "../../lib/asset-links";

export const dynamic = "force-dynamic";

export function GET() {
  const fingerprints = parseSha256Fingerprints(
    process.env.ASTIAN_ANDROID_SHA256_CERT_FINGERPRINTS,
  );
  const statements = createAndroidAssetLinks(
    fingerprints,
    process.env.ASTIAN_ANDROID_PACKAGE_NAME ?? "org.astian.suite.maps",
  );

  return Response.json(statements, {
    status: statements.length > 0 ? 200 : 503,
    headers: {
      "Cache-Control": "public, max-age=300, must-revalidate",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
