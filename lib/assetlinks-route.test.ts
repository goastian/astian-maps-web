import { afterEach, describe, expect, it } from "vitest";
import { GET } from "../app/assetlinks/route";

const fingerprint = Array.from({ length: 32 }, (_, index) =>
  index.toString(16).padStart(2, "0"),
).join(":");
const previousFingerprint = process.env.ASTIAN_ANDROID_SHA256_CERT_FINGERPRINTS;
const previousPackage = process.env.ASTIAN_ANDROID_PACKAGE_NAME;

afterEach(() => {
  restoreEnvironment(
    "ASTIAN_ANDROID_SHA256_CERT_FINGERPRINTS",
    previousFingerprint,
  );
  restoreEnvironment("ASTIAN_ANDROID_PACKAGE_NAME", previousPackage);
});

describe("/.well-known/assetlinks.json response", () => {
  it("publishes a cacheable association when release signing is configured", async () => {
    process.env.ASTIAN_ANDROID_SHA256_CERT_FINGERPRINTS = fingerprint;
    process.env.ASTIAN_ANDROID_PACKAGE_NAME = "org.astian.suite.maps";

    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toContain("must-revalidate");
    expect(await response.json()).toMatchObject([
      {
        target: {
          package_name: "org.astian.suite.maps",
          sha256_cert_fingerprints: [fingerprint.toUpperCase()],
        },
      },
    ]);
  });

  it("fails closed until a valid release fingerprint is supplied", async () => {
    delete process.env.ASTIAN_ANDROID_SHA256_CERT_FINGERPRINTS;

    const response = GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual([]);
  });
});

function restoreEnvironment(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
