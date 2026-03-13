/**
 * Load execa via dynamic import so the package works when compiled to CommonJS.
 * execa@8 is ESM-only; require("execa") throws ERR_REQUIRE_ESM on some Node versions.
 */
let cached: typeof import("execa").execa | null = null;

export async function getExeca(): Promise<typeof import("execa").execa> {
  if (!cached) {
    const m = await import("execa");
    cached = m.execa;
  }
  return cached;
}
