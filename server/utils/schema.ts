import { sql } from "drizzle-orm";
import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Skema tabel auth — HARUS identik dengan ../mylpg/server/utils/auth-db/schema.ts.
 * Hidup di Turso remote (TURSO_DATABASE_URL + TURSO_DATABASE_TOKEN) dan dibagi
 * bersama aplikasi mylpg. App ini adalah panel manajemen untuk tabel yang sama.
 */
export const appUsersTable = sqliteTable("app_users", {
  id: int().primaryKey({ autoIncrement: true }),
  username: text().notNull().unique(),
  passwordHash: text().notNull(),
  displayName: text().notNull().default(""),
  /** "admin" bisa kelola user; "user" hanya pakai aplikasi. */
  role: text().notNull().default("user"),
  /** Nonaktifkan tanpa hapus. */
  isActive: int({ mode: "boolean" }).notNull().default(true),
  /** Masa sewa habis. null = tak terbatas. */
  expiresAt: int({ mode: "timestamp_ms" }),
  /** Maks sesi/device aktif bersamaan. */
  maxSessions: int().notNull().default(1),
  lastLoginAt: int({ mode: "timestamp_ms" }),
  createdAt: int({ mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

/**
 * Sesi login aktif aplikasi mylpg (anti-sharing). Dikelola oleh app ini juga
 * supaya admin bisa melihat & mencabut sesi.
 */
export const appSessionsTable = sqliteTable("app_sessions", {
  id: text().primaryKey(),
  userId: int()
    .notNull()
    .references(() => appUsersTable.id),
  ip: text(),
  userAgent: text(),
  createdAt: int({ mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  lastSeenAt: int({ mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  expiresAt: int({ mode: "timestamp_ms" }),
  revokedAt: int({ mode: "timestamp_ms" }),
});
