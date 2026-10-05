import { requireAdmin } from "../../utils/admin-auth";
import { getAuthDb } from "../../utils/auth-db";
import { hashBcrypt } from "../../utils/password";
import {
  parseExpiresAt,
  parseId,
  parseMaxSessions,
  parsePassword,
  parseRole,
} from "../../utils/validation";

/** UPDATE user (semua field opsional). Reset password jika dikirim. */
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event);
  const id = parseId(getRouterParam(event, "id"));
  const body = await readBody<Record<string, unknown>>(event);

  const authDb = getAuthDb();
  const target = await authDb.getUser(id);
  if (!target) throw createError({ statusCode: 404, message: "User tidak ditemukan." });

  const patch: Partial<{
    displayName: string;
    role: string;
    isActive: boolean;
    expiresAt: Date | null;
    maxSessions: number;
    passwordHash: string;
  }> = {};

  if (body?.displayName !== undefined) {
    patch.displayName =
      typeof body.displayName === "string" ? body.displayName.trim().slice(0, 120) : "";
  }
  if (body?.role !== undefined) patch.role = parseRole(body.role);
  if (body?.isActive !== undefined) patch.isActive = Boolean(body.isActive);
  if (body?.expiresAt !== undefined) patch.expiresAt = parseExpiresAt(body.expiresAt);
  if (body?.maxSessions !== undefined)
    patch.maxSessions = parseMaxSessions(body.maxSessions);
  if (body?.password !== undefined && body.password !== "") {
    patch.passwordHash = await hashBcrypt(parsePassword(body.password));
  }

  // Jaga-jaga: admin tidak boleh menonaktifkan / mendegradasi dirinya sendiri
  // sampai terkunci dari panel.
  if (id === admin.id) {
    if (patch.isActive === false) {
      throw createError({
        statusCode: 400,
        message: "Tidak bisa menonaktifkan akun Anda sendiri.",
      });
    }
    if (patch.role && patch.role !== "admin") {
      throw createError({
        statusCode: 400,
        message: "Tidak bisa menurunkan peran akun Anda sendiri dari admin.",
      });
    }
  }

  await authDb.updateUser(id, patch);

  // Kalau dinonaktifkan atau masa sewa dimundurkan, cabut sesi aktif mylpg.
  if (patch.isActive === false) {
    await authDb.revokeAllSessions(id);
  }

  const updated = await authDb.getUser(id);
  return {
    ok: true,
    user: updated
      ? {
          id: updated.id,
          username: updated.username,
          displayName: updated.displayName,
          role: updated.role,
          isActive: updated.isActive,
          expiresAt: updated.expiresAt,
          maxSessions: updated.maxSessions,
          lastLoginAt: updated.lastLoginAt,
          createdAt: updated.createdAt,
        }
      : null,
  };
});
