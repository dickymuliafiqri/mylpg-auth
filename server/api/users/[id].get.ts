import { requireAdmin } from "../../utils/admin-auth";
import { getAuthDb } from "../../utils/auth-db";
import { parseId } from "../../utils/validation";

/** Detail satu user + sesi aktifnya. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const id = parseId(getRouterParam(event, "id"));

  const authDb = getAuthDb();
  const u = await authDb.getUser(id);
  if (!u) throw createError({ statusCode: 404, message: "User tidak ditemukan." });

  const sessions = await authDb.activeSessions(id);
  return {
    user: {
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      role: u.role,
      isActive: u.isActive,
      expiresAt: u.expiresAt,
      maxSessions: u.maxSessions,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
    },
    sessions: sessions.map((s) => ({
      id: s.id,
      ip: s.ip,
      userAgent: s.userAgent,
      createdAt: s.createdAt,
      lastSeenAt: s.lastSeenAt,
      expiresAt: s.expiresAt,
    })),
  };
});
