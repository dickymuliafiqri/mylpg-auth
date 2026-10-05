import { createClient } from "@tursodatabase/serverless/compat";
// `construct(client, config)` ada di runtime driver-core.js tapi tidak
// diekspor di .d.ts drizzle. Kita pakai ini (bukan `drizzle` dari driver.js)
// supaya `@libsql/client` — yang di-import eager oleh driver.js dan menarik
// dependensi native/WebSocket — TIDAK ikut ter-bundle. Aman untuk serverless
// Vercel; koneksi lewat @tursodatabase/serverless/compat.
// @ts-expect-error — `construct` tidak ada di tipe publik, hanya di runtime.
import { construct as createDrizzle } from "drizzle-orm/libsql/driver-core";
import type { LibSQLDatabase } from "drizzle-orm/libsql/driver-core";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { appSessionsTable, appUsersTable } from "./schema";

type AuthSchema = typeof import("./schema");
type AuthDb = LibSQLDatabase<AuthSchema>;
type LibsqlCompatClient = ReturnType<typeof createClient>;

/** Masa aktif sesi aplikasi mylpg (sliding), dipotong oleh user.expiresAt. */
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 hari

export interface AppUserRow {
  id: number;
  username: string;
  passwordHash: string;
  displayName: string;
  role: string;
  isActive: boolean;
  expiresAt: Date | null;
  maxSessions: number;
  lastLoginAt: Date | null;
  createdAt: Date | null;
}

export type PublicAppUser = Omit<AppUserRow, "passwordHash">;

export interface AppSessionRow {
  id: string;
  userId: number;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date | null;
  lastSeenAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
}

/**
 * DDL idempoten — menjamin tabel otomatis dibuat saat app start. Sengaja
 * identik dengan ../mylpg/server/utils/auth-db/index.ts agar kompatibel.
 */
const ENSURE_AUTH_TABLES_SQL = [
  `CREATE TABLE IF NOT EXISTS app_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    passwordHash TEXT NOT NULL,
    displayName TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'user',
    isActive INTEGER NOT NULL DEFAULT 1,
    expiresAt INTEGER,
    maxSessions INTEGER NOT NULL DEFAULT 1,
    lastLoginAt INTEGER,
    createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE TABLE IF NOT EXISTS app_sessions (
    id TEXT PRIMARY KEY,
    userId INTEGER NOT NULL,
    ip TEXT,
    userAgent TEXT,
    createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    lastSeenAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    expiresAt INTEGER,
    revokedAt INTEGER
  )`,
];

export class AuthDatabase {
  private client: LibsqlCompatClient;
  private db: AuthDb;

  constructor(url: string, authToken: string) {
    // Trim: nilai dari env (mis. Environment Variables Vercel) sering membawa
    // newline/spasi di ujung saat di-paste. Token yang mengandung "\n" membuat
    // header HTTP `Authorization: Bearer ...` tidak valid dan fetch menolaknya
    // ("Header has invalid value"). Bersihkan whitespace di kedua ujung.
    const cleanUrl = url.trim();
    const cleanToken = authToken.trim();
    if (!cleanUrl || !cleanToken) {
      throw new Error(
        "Auth DB butuh TURSO_DATABASE_URL + TURSO_DATABASE_TOKEN (Turso remote).",
      );
    }
    // Driver @tursodatabase/serverless (SQL-over-HTTP, tanpa dependensi
    // native/WebSocket) agar aman di runtime serverless Vercel. Layer /compat
    // menyediakan Client yang drop-in dengan @libsql/client, jadi adapter
    // drizzle-orm/libsql tetap dipakai tanpa perubahan query.
    this.client = createClient({ url: cleanUrl, authToken: cleanToken });
    this.db = createDrizzle(this.client, {
      schema: { appUsersTable, appSessionsTable },
    }) as AuthDb;
  }

  async ensureTables(): Promise<void> {
    for (const stmt of ENSURE_AUTH_TABLES_SQL) {
      await this.client.execute(stmt);
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.client.execute("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }

  // ========== USERS ==========

  async countUsers(): Promise<number> {
    const rows = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(appUsersTable);
    return rows[0]?.count ?? 0;
  }

  async findUser(username: string): Promise<AppUserRow | undefined> {
    const rows = await this.db
      .select()
      .from(appUsersTable)
      .where(eq(appUsersTable.username, username))
      .limit(1);
    return rows[0] as AppUserRow | undefined;
  }

  async getUser(id: number): Promise<AppUserRow | undefined> {
    const rows = await this.db
      .select()
      .from(appUsersTable)
      .where(eq(appUsersTable.id, id))
      .limit(1);
    return rows[0] as AppUserRow | undefined;
  }

  async listUsers(): Promise<PublicAppUser[]> {
    const rows = await this.db
      .select()
      .from(appUsersTable)
      .orderBy(desc(appUsersTable.id));
    return rows.map((r) => ({
      id: r.id,
      username: r.username,
      displayName: r.displayName,
      role: r.role,
      isActive: r.isActive,
      expiresAt: r.expiresAt,
      maxSessions: r.maxSessions,
      lastLoginAt: r.lastLoginAt,
      createdAt: r.createdAt,
    }));
  }

  async createUser(input: {
    username: string;
    passwordHash: string;
    displayName?: string;
    role?: string;
    isActive?: boolean;
    expiresAt?: Date | null;
    maxSessions?: number;
  }): Promise<number> {
    const res = await this.db.insert(appUsersTable).values({
      username: input.username,
      passwordHash: input.passwordHash,
      displayName: input.displayName ?? "",
      role: input.role ?? "user",
      isActive: input.isActive ?? true,
      expiresAt: input.expiresAt ?? null,
      maxSessions: input.maxSessions ?? 1,
    });
    return Number(res.lastInsertRowid);
  }

  async updateUser(
    id: number,
    patch: Partial<{
      displayName: string;
      role: string;
      isActive: boolean;
      expiresAt: Date | null;
      maxSessions: number;
      passwordHash: string;
    }>,
  ): Promise<void> {
    if (Object.keys(patch).length === 0) return;
    await this.db.update(appUsersTable).set(patch).where(eq(appUsersTable.id, id));
  }

  async touchLastLogin(id: number): Promise<void> {
    await this.db
      .update(appUsersTable)
      .set({ lastLoginAt: new Date() })
      .where(eq(appUsersTable.id, id));
  }

  async deleteUser(id: number): Promise<void> {
    await this.db.delete(appSessionsTable).where(eq(appSessionsTable.userId, id));
    await this.db.delete(appUsersTable).where(eq(appUsersTable.id, id));
  }

  // ========== SESSIONS (anti-sharing) ==========

  async activeSessions(userId: number): Promise<AppSessionRow[]> {
    const now = Date.now();
    const rows = await this.db
      .select()
      .from(appSessionsTable)
      .where(
        and(eq(appSessionsTable.userId, userId), isNull(appSessionsTable.revokedAt)),
      );
    return (rows as AppSessionRow[]).filter(
      (s) => !s.expiresAt || s.expiresAt.getTime() > now,
    );
  }

  async createSession(input: {
    userId: number;
    ip?: string | null;
    userAgent?: string | null;
    userExpiresAt?: Date | null;
  }): Promise<AppSessionRow> {
    const id = randomUUID();
    const now = Date.now();
    let expiresAt = now + SESSION_TTL_MS;
    if (input.userExpiresAt) {
      expiresAt = Math.min(expiresAt, input.userExpiresAt.getTime());
    }
    const row = {
      id,
      userId: input.userId,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      createdAt: new Date(now),
      lastSeenAt: new Date(now),
      expiresAt: new Date(expiresAt),
      revokedAt: null,
    };
    await this.db.insert(appSessionsTable).values(row);
    return row as AppSessionRow;
  }

  async getValidSession(sessionId: string): Promise<AppSessionRow | undefined> {
    const rows = await this.db
      .select()
      .from(appSessionsTable)
      .where(eq(appSessionsTable.id, sessionId))
      .limit(1);
    const s = rows[0] as AppSessionRow | undefined;
    if (!s) return undefined;
    if (s.revokedAt) return undefined;
    if (s.expiresAt && s.expiresAt.getTime() <= Date.now()) return undefined;
    return s;
  }

  async touchSession(sessionId: string, userExpiresAt?: Date | null): Promise<void> {
    const now = Date.now();
    let expiresAt = now + SESSION_TTL_MS;
    if (userExpiresAt) expiresAt = Math.min(expiresAt, userExpiresAt.getTime());
    await this.db
      .update(appSessionsTable)
      .set({ lastSeenAt: new Date(now), expiresAt: new Date(expiresAt) })
      .where(eq(appSessionsTable.id, sessionId));
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.db
      .update(appSessionsTable)
      .set({ revokedAt: new Date() })
      .where(eq(appSessionsTable.id, sessionId));
  }

  async revokeAllSessions(userId: number): Promise<void> {
    await this.db
      .update(appSessionsTable)
      .set({ revokedAt: new Date() })
      .where(
        and(eq(appSessionsTable.userId, userId), isNull(appSessionsTable.revokedAt)),
      );
  }

  /** Jumlah sesi aktif per user (untuk tampilan dashboard). */
  async activeSessionCounts(): Promise<Map<number, number>> {
    const now = Date.now();
    const rows = await this.db
      .select()
      .from(appSessionsTable)
      .where(isNull(appSessionsTable.revokedAt));
    const map = new Map<number, number>();
    for (const s of rows as AppSessionRow[]) {
      if (s.expiresAt && s.expiresAt.getTime() <= now) continue;
      map.set(s.userId, (map.get(s.userId) ?? 0) + 1);
    }
    return map;
  }
}

let authDbInstance: AuthDatabase | undefined;

/** Singleton AuthDatabase. Kredensial dari runtimeConfig (env). */
export function getAuthDb(): AuthDatabase {
  if (!authDbInstance) {
    const cfg = useRuntimeConfig();
    authDbInstance = new AuthDatabase(cfg.tursoDatabaseUrl, cfg.tursoDatabaseToken);
  }
  return authDbInstance;
}
