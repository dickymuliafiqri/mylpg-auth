import { requireAdmin } from "../../utils/admin-auth";
import { getAuthDb } from "../../utils/auth-db";

/** List semua user + jumlah sesi aktif per user. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const authDb = getAuthDb();
  const [users, counts] = await Promise.all([
    authDb.listUsers(),
    authDb.activeSessionCounts(),
  ]);
  return {
    users: users.map((u) => ({
      ...u,
      activeSessions: counts.get(u.id) ?? 0,
    })),
  };
});
