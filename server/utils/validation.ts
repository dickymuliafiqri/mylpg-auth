/** Helper validasi & parsing input tanpa dependensi eksternal. */

export function parseUsername(raw: unknown): string {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (v.length < 3 || v.length > 64) {
    throw createError({
      statusCode: 400,
      message: "Username wajib 3–64 karakter.",
    });
  }
  if (!/^[a-zA-Z0-9._@+-]+$/.test(v)) {
    throw createError({
      statusCode: 400,
      message: "Username hanya boleh huruf, angka, dan . _ @ + -",
    });
  }
  return v;
}

export function parsePassword(raw: unknown): string {
  const v = typeof raw === "string" ? raw : "";
  if (v.length < 6 || v.length > 128) {
    throw createError({
      statusCode: 400,
      message: "Password wajib 6–128 karakter.",
    });
  }
  return v;
}

export function parseRole(raw: unknown): "admin" | "user" {
  if (raw === "admin" || raw === "user") return raw;
  throw createError({ statusCode: 400, message: "Role harus 'admin' atau 'user'." });
}

export function parseMaxSessions(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 100) {
    throw createError({
      statusCode: 400,
      message: "maxSessions harus bilangan bulat 1–100.",
    });
  }
  return n;
}

/** Terima null, string ISO, atau epoch ms. Mengembalikan Date | null. */
export function parseExpiresAt(raw: unknown): Date | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") {
    const d = new Date(raw);
    if (isNaN(d.getTime())) {
      throw createError({ statusCode: 400, message: "expiresAt tidak valid." });
    }
    return d;
  }
  if (typeof raw === "string") {
    const d = new Date(raw);
    if (isNaN(d.getTime())) {
      throw createError({ statusCode: 400, message: "expiresAt tidak valid." });
    }
    return d;
  }
  throw createError({ statusCode: 400, message: "expiresAt tidak valid." });
}

export function parseId(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw createError({ statusCode: 400, message: "id tidak valid." });
  }
  return n;
}
