import { getAuthDb } from "../../utils/auth-db";
import { requireApiKey } from "../../utils/public-api";

/**
 * PUBLIC API — verifikasi sesi mylpg tiap request terproteksi.
 *
 * mylpg mengirim sessionId yang didapat saat /public/login. Endpoint ini
 * memastikan sesi masih ada, belum di-revoke, belum expired, user masih aktif
 * dan belum lewat masa sewa. Jika valid, lastSeenAt + expiry sesi diperbarui
 * (sliding), lalu mengembalikan data user.
 *
 * Body: { sessionId }
 * 200:  { ok: true, user: {...}, expiresAt }
 * 401:  sesi tidak valid / dicabut / kedaluwarsa
 * 403:  akun nonaktif / masa sewa habis
 */
export default defineEventHandler(async (event) => {
  requireApiKey(event);

  const body = await readBody<{ sessionId?: string }>(event);
  const sessionId = (body?.sessionId ?? "").trim();
  if (!sessionId) {
    throw createError({ statusCode: 400, message: "sessionId wajib." });
  }

  const authDb = getAuthDb();
  const sess = await authDb.getValidSession(sessionId);
  if (!sess) {
    throw createError({
      statusCode: 401,
      message: "Sesi berakhir atau dicabut. Silakan login ulang.",
    });
  }

  const user = await authDb.getUser(sess.userId);
  if (!user || !user.isActive) {
    await authDb.revokeSession(sessionId);
    throw createError({ statusCode: 403, message: "Akun dinonaktifkan." });
  }
  if (user.expiresAt && user.expiresAt.getTime() <= Date.now()) {
    await authDb.revokeSession(sessionId);
    throw createError({ statusCode: 403, message: "Masa aktif akun telah berakhir." });
  }

  // Heartbeat sliding expiry (abaikan kegagalan tulis — bukan kritis).
  authDb.touchSession(sessionId, user.expiresAt).catch(() => {});

  return {
    ok: true,
    expiresAt: sess.expiresAt,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      expiresAt: user.expiresAt,
    },
  };
});
