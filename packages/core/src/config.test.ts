import { readPublicConfig } from "./config";

describe("readPublicConfig", () => {
  it("accepts both Convex URLs and trims a trailing slash", () => {
    expect(
      readPublicConfig({
        EXPO_PUBLIC_CONVEX_SITE_URL: "https://example-123.convex.site/",
        EXPO_PUBLIC_CONVEX_URL: "https://example-123.convex.cloud",
      })
    ).toEqual({
      convexUrl: "https://example-123.convex.cloud",
      ok: true,
      siteUrl: "https://example-123.convex.site",
    });
  });

  it("names every missing or malformed value", () => {
    expect(
      readPublicConfig({ EXPO_PUBLIC_CONVEX_SITE_URL: "not a url", EXPO_PUBLIC_CONVEX_URL: "" })
    ).toEqual({ missing: ["EXPO_PUBLIC_CONVEX_URL", "EXPO_PUBLIC_CONVEX_SITE_URL"], ok: false });
  });

  it("allows a local http deployment", () => {
    const result = readPublicConfig({
      EXPO_PUBLIC_CONVEX_SITE_URL: "http://127.0.0.1:3211",
      EXPO_PUBLIC_CONVEX_URL: "http://127.0.0.1:3210",
    });
    expect(result.ok).toBe(true);
  });
});
