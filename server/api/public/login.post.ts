import { getAuthDb } from "../../utils/auth-db";
import { verifyPasswordHash } from "../../utils/password";
import { getClientIp, requireApiKey } from "../../utils/public-api";
import {
  LOGIN_RATE_LIMIT,
  checkRateLimit,
  recordFailure,
  resetRateLimit,
} from "../../utils/rate-limit";

/**
 * PUBLIC API — dipanggil oleh aplikasi ../mylpg untuk mengautentikasi usernya.
 *
 * Alur sama dengan login mylpg: verifikasi password (bcrypt), cek lisensi
 * (isActive + expiresAt), anti-sharing (maxSessions), lalu buat baris
 * app_sessions dan KEMBALIKAN sessionId. mylpg menyimpan sessionId tsb dan
 * mengirimnya kembali di /api/public/verify tiap request terproteksi.
 *
 * Dilindungi rate limit per (IP + username) terhadap brute force.
 *
 * Body: { username, password }
 * 200:  { ok, sessionId, expiresAt, user: { id, username, displayName, role } }
 */
export default defineEventHandler(async (event) => {
  requireApiKey(event);

  const body = await readBody<{ username?: string; password?: string }>(event);
  const username = (body?.username ?? "").trim();
  const password = body?.password ?? "";
  const ip = getClientIp(event);
  const userAgent = getRequestHeader(event, "user-agent") ?? null;

  if (!username || !password) {
    throw createError({ statusCode: 400, message: "Username dan password wajib." });
  }

  const rlKey = `public-login:${ip}:${username.toLowerCase()}`;
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
    throw createError({ statusCode: 401, message: "Username atau password salah." });
  };

  if (!appUser) return invalid();

  const ok = await verifyPasswordHash(password, appUser.passwordHash);
  if (!ok) return invalid();

  if (!appUser.isActive) {
    throw createError({ statusCode: 403, message: "Akun dinonaktifkan." });
  }
  if (appUser.expiresAt && appUser.expiresAt.getTime() <= Date.now()) {
    throw createError({ statusCode: 403, message: "Masa aktif akun telah berakhir." });
  }

  // Anti-sharing: batasi sesi aktif bersamaan.
  const active = await authDb.activeSessions(appUser.id);
  if (active.length >= appUser.maxSessions) {
    throw createError({
      statusCode: 409,
      message:
        appUser.maxSessions === 1
          ? "Akun sedang dipakai di perangkat lain. Logout dulu di sana."
          : `Batas ${appUser.maxSessions} sesi aktif tercapai.`,
    });
  }

  resetRateLimit(rlKey);

  const sess = await authDb.createSession({
    userId: appUser.id,
    ip,
    userAgent,
    userExpiresAt: appUser.expiresAt,
  });
  await authDb.touchLastLogin(appUser.id);

  return {
    ok: true,
    sessionId: sess.id,
    expiresAt: sess.expiresAt,
    user: {
      id: appUser.id,
      username: appUser.username,
      displayName: appUser.displayName,
      role: appUser.role,
    },
  };
});
