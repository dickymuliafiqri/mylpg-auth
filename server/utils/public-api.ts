import type { H3Event } from "h3";

/**
 * Proteksi opsional untuk public API. Jika PUBLIC_API_KEY diset di env, maka
 * request ke /api/public/* WAJIB membawa header `x-api-key` yang cocok.
 * Jika kosong, proteksi dimatikan (berguna untuk pengembangan lokal).
 */
export function requireApiKey(event: H3Event): void {
  const cfg = useRuntimeConfig();
  const expected = cfg.publicApiKey;
  if (!expected) return; // proteksi dimatikan
  const got = getRequestHeader(event, "x-api-key") ?? "";
  // Perbandingan waktu-konstan sederhana.
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) {
    throw createError({ statusCode: 401, message: "API key tidak valid." });
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Ambil IP klien dari header proxy umum. */
export function getClientIp(event: H3Event): string {
  return (
    getRequestHeader(event, "x-forwarded-for")?.split(",")[0]?.trim() ||
    getRequestIP(event, { xForwardedFor: true }) ||
    "unknown"
  );
}
