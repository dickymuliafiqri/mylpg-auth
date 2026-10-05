import type { H3Event } from "h3";
import { getAuthDb } from "./auth-db";

/**
 * Identitas admin dashboard yang disimpan di cookie session (nuxt-auth-utils).
 * Ini terpisah dari sesi aplikasi mylpg (app_sessions) — cookie ini hanya untuk
 * memakai panel manajemen ini. Hak akses: hanya role "admin".
 */
export interface AdminSessionUser {
  id: number;
  username: string;
  displayName: string;
  role: string;
}

/**
 * Pastikan request datang dari admin dashboard yang login & masih admin aktif.
 * Melempar 401/403 bila tidak. Diverifikasi ulang ke DB tiap request supaya
 * pencabutan hak admin langsung berlaku.
 */
export async function requireAdmin(event: H3Event): Promise<AdminSessionUser> {
  const session = await requireUserSession(event);
  const sUser = session.user as AdminSessionUser | undefined;
  if (!sUser?.id) {
    await clearUserSession(event);
    throw createError({ statusCode: 401, message: "Sesi tidak valid." });
  }

  const authDb = getAuthDb();
  const dbUser = await authDb.getUser(sUser.id);
  if (!dbUser || !dbUser.isActive) {
    await clearUserSession(event);
    throw createError({ statusCode: 403, message: "Akun dinonaktifkan." });
  }
  if (dbUser.role !== "admin") {
    throw createError({ statusCode: 403, message: "Butuh hak admin." });
  }
  if (dbUser.expiresAt && dbUser.expiresAt.getTime() <= Date.now()) {
    throw createError({ statusCode: 403, message: "Masa aktif akun telah berakhir." });
  }

  return {
    id: dbUser.id,
    username: dbUser.username,
    displayName: dbUser.displayName,
    role: dbUser.role,
  };
}
