import { requireAdmin } from "../../../utils/admin-auth";
import { getAuthDb } from "../../../utils/auth-db";
import { parseId } from "../../../utils/validation";

/** Cabut SEMUA sesi aktif mylpg milik user (paksa logout di semua device). */
export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const id = parseId(getRouterParam(event, "id"));

  const authDb = getAuthDb();
  const target = await authDb.getUser(id);
  if (!target) throw createError({ statusCode: 404, message: "User tidak ditemukan." });

  await authDb.revokeAllSessions(id);
  return { ok: true };
});
