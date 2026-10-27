import { describe, expect, it } from "vitest";
import {
  createAndroidAssetLinks,
  parseSha256Fingerprints,
} from "./asset-links";

const fingerprint = Array.from({ length: 32 }, (_, index) =>
  index.toString(16).padStart(2, "0"),
).join(":");

describe("Android App Link association", () => {
  it("normalizes, validates and deduplicates release fingerprints", () => {
    expect(
      parseSha256Fingerprints(`${fingerprint}, invalid, ${fingerprint.toUpperCase()}`),
    ).toEqual([fingerprint.toUpperCase()]);
  });

  it("builds the exact handle-all-urls association for Astian Maps", () => {
    const normalized = fingerprint.toUpperCase();
    expect(createAndroidAssetLinks([normalized])).toEqual([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "org.astian.suite.maps",
          sha256_cert_fingerprints: [normalized],
        },
      },
    ]);
  });

  it("does not publish an unverifiable association", () => {
    expect(createAndroidAssetLinks([])).toEqual([]);
  });
});
