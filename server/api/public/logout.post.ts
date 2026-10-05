import { getAuthDb } from "../../utils/auth-db";
import { requireApiKey } from "../../utils/public-api";

/**
 * PUBLIC API — logout mylpg: cabut (revoke) satu sesi berdasarkan sessionId.
 *
 * Body: { sessionId }
 * 200:  { ok: true }
 */
export default defineEventHandler(async (event) => {
  requireApiKey(event);

  const body = await readBody<{ sessionId?: string }>(event);
  const sessionId = (body?.sessionId ?? "").trim();
  if (!sessionId) {
    throw createError({ statusCode: 400, message: "sessionId wajib." });
  }

  const authDb = getAuthDb();
  await authDb.revokeSession(sessionId);
  return { ok: true };
});
