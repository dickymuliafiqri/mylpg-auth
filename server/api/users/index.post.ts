import { requireAdmin } from "../../utils/admin-auth";
import { getAuthDb } from "../../utils/auth-db";
import { hashBcrypt } from "../../utils/password";
import {
  parseExpiresAt,
  parseMaxSessions,
  parsePassword,
  parseRole,
  parseUsername,
} from "../../utils/validation";

/** CREATE user baru. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const body = await readBody<Record<string, unknown>>(event);

  const username = parseUsername(body?.username);
  const password = parsePassword(body?.password);
  const role = body?.role === undefined ? "user" : parseRole(body.role);
  const displayName =
    typeof body?.displayName === "string" ? body.displayName.trim().slice(0, 120) : "";
  const maxSessions =
    body?.maxSessions === undefined ? 1 : parseMaxSessions(body.maxSessions);
  const expiresAt = parseExpiresAt(body?.expiresAt);
  const isActive = body?.isActive === undefined ? true : Boolean(body.isActive);

  const authDb = getAuthDb();
  const existing = await authDb.findUser(username);
  if (existing) {
    throw createError({ statusCode: 409, message: "Username sudah dipakai." });
  }

  const passwordHash = await hashBcrypt(password);
  const id = await authDb.createUser({
    username,
    passwordHash,
    displayName,
    role,
    isActive,
    expiresAt,
    maxSessions,
  });

  const created = await authDb.getUser(id);
  return {
    ok: true,
    user: created
      ? {
          id: created.id,
          username: created.username,
          displayName: created.displayName,
          role: created.role,
          isActive: created.isActive,
          expiresAt: created.expiresAt,
          maxSessions: created.maxSessions,
          lastLoginAt: created.lastLoginAt,
          createdAt: created.createdAt,
        }
      : null,
  };
});
