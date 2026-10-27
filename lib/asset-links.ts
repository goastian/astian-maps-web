export interface AndroidAssetLinkStatement {
  relation: ["delegate_permission/common.handle_all_urls"];
  target: {
    namespace: "android_app";
    package_name: string;
    sha256_cert_fingerprints: string[];
  };
}

const SHA256_FINGERPRINT = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;

export function parseSha256Fingerprints(value?: string): string[] {
  if (!value) return [];
  return [
    ...new Set(
      value
        .split(",")
        .map((fingerprint) => fingerprint.trim().toUpperCase())
        .filter((fingerprint) => SHA256_FINGERPRINT.test(fingerprint)),
    ),
  ];
}

export function createAndroidAssetLinks(
  fingerprints: string[],
  packageName = "org.astian.suite.maps",
): AndroidAssetLinkStatement[] {
  if (fingerprints.length === 0) return [];
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: packageName,
        sha256_cert_fingerprints: [...fingerprints],
      },
    },
  ];
}
