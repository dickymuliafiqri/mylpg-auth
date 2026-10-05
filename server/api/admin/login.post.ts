import type { AdminSessionUser } from "../../utils/admin-auth";
import { getAuthDb } from "../../utils/auth-db";
import { verifyPasswordHash } from "../../utils/password";
import {
  LOGIN_RATE_LIMIT,
  checkRateLimit,
  recordFailure,
  resetRateLimit,
} from "../../utils/rate-limit";

/**
 * Login admin dashboard. Dilindungi rate limit per (IP + username) untuk
 * menahan brute-force: 5 gagal / 5 menit -> blokir 15 menit (lihat rate-limit.ts).
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ username?: string; password?: string }>(event);
  const username = (body?.username ?? "").trim();
  const password = body?.password ?? "";

  const ip =
    getRequestHeader(event, "x-forwarded-for")?.split(",")[0]?.trim() ||
    getRequestIP(event, { xForwardedFor: true }) ||
    "unknown";

  if (!username || !password) {
    throw createError({ statusCode: 400, message: "Username dan password wajib." });
  }

  const rlKey = `admin-login:${ip}:${username.toLowerCase()}`;

  // Cek blokir SEBELUM menyentuh DB.
  const pre = checkRateLimit(rlKey, LOGIN_RATE_LIMIT);
  if (pre.blocked) {
    setResponseHeader(event, "Retry-After", pre.retryAfterSec);
    throw createError({
      statusCode: 429,
      message: `Terlalu banyak percobaan. Coba lagi dalam ${pre.retryAfterSec} detik.`,
    });
  }

  const authDb = getAuthDb();
  const appUser = await authDb.findUser(username);

  const invalid = () => {
    const st = recordFailure(rlKey, LOGIN_RATE_LIMIT);
    if (st.blocked) {
      setResponseHeader(event, "Retry-After", st.retryAfterSec);
      throw createError({
        statusCode: 429,
        message: `Terlalu banyak percobaan. Coba lagi dalam ${st.retryAfterSec} detik.`,
      });
    }
    throw createError({
      statusCode: 401,
      message: `Username atau password salah. Sisa percobaan: ${st.remaining}.`,
    });
  };

  if (!appUser) return invalid();

  const ok = await verifyPasswordHash(password, appUser.passwordHash);
  if (!ok) return invalid();

  // Hanya admin yang boleh masuk panel ini.
  if (appUser.role !== "admin") {
    throw createError({
      statusCode: 403,
      message: "Hanya admin yang boleh mengakses panel manajemen.",
    });
  }
  if (!appUser.isActive) {
    throw createError({ statusCode: 403, message: "Akun dinonaktifkan." });
  }
  if (appUser.expiresAt && appUser.expiresAt.getTime() <= Date.now()) {
    throw createError({ statusCode: 403, message: "Masa aktif akun telah berakhir." });
  }

  // Sukses -> reset counter, catat login, set cookie session dashboard.
  resetRateLimit(rlKey);
  await authDb.touchLastLogin(appUser.id);

  const user: AdminSessionUser = {
    id: appUser.id,
    username: appUser.username,
    displayName: appUser.displayName,
    role: appUser.role,
  };
  await setUserSession(event, { user });
  return { ok: true, user };
});
