import { requireAdmin } from "../../utils/admin-auth";
import { getAuthDb } from "../../utils/auth-db";
import { parseId } from "../../utils/validation";

/** DELETE user (beserta sesinya). */
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event);
  const id = parseId(getRouterParam(event, "id"));

  if (id === admin.id) {
    throw createError({
      statusCode: 400,
      message: "Tidak bisa menghapus akun Anda sendiri.",
    });
  }

  const authDb = getAuthDb();
  const target = await authDb.getUser(id);
  if (!target) throw createError({ statusCode: 404, message: "User tidak ditemukan." });

  await authDb.deleteUser(id);
  return { ok: true };
});
