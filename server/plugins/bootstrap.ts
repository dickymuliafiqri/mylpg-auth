import { getAuthDb } from "../utils/auth-db";

/**
 * Startup Nitro:
 *   1. Pastikan koneksi Turso hidup.
 *   2. Auto-create tabel app_users + app_sessions (idempoten).
 *   3. Seed admin dashboard pertama dari APP_USERNAME/APP_PASSWORD bila kosong.
 */
export default defineNitroPlugin(async () => {
  const cfg = useRuntimeConfig();
  const authDb = getAuthDb();

  const ok = await authDb.testConnection();
  if (!ok) {
    console.error(
      "[BOOT] Gagal konek Turso. Cek TURSO_DATABASE_URL / TURSO_DATABASE_TOKEN.",
    );
    return;
  }

  await authDb.ensureTables();

  const count = await authDb.countUsers();
  if (count === 0) {
    if (cfg.appUsername && cfg.appPassword) {
      const passwordHash = await hashBcrypt(cfg.appPassword);
      await authDb.createUser({
        username: cfg.appUsername,
        passwordHash,
        displayName: "Admin",
        role: "admin",
        expiresAt: null,
        maxSessions: 5,
      });
      console.info(`[BOOT] User admin "${cfg.appUsername}" dibuat dari seed env.`);
    } else {
      console.warn(
        "[BOOT] app_users kosong & APP_USERNAME/APP_PASSWORD belum diset — belum ada admin.",
      );
    }
  }

  console.info("[BOOT] mylpg-auth siap — tabel auth dipastikan ada di Turso remote.");
});
