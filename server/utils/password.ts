import bcrypt from "bcryptjs";

/**
 * Hashing password dengan bcrypt (pure-JS, lintas runtime Node & Bun).
 *
 * Hash yang dihasilkan berformat bcrypt standar ($2a$/$2b$...), jadi
 * KOMPATIBEL PENUH dengan ../mylpg yang memverifikasi memakai `Bun.password`
 * (algoritma bcrypt). Dengan bcryptjs, app ini tidak lagi mewajibkan runtime
 * Bun — bisa dijalankan dengan `node .output/server/index.mjs` maupun Bun.
 *
 * cost 10 = default yang sama dengan Bun.password bcrypt.
 */
const BCRYPT_COST = 10;

/** Hash password dengan bcrypt. */
export async function hashBcrypt(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

/** Verifikasi password terhadap hash bcrypt. */
export async function verifyPasswordHash(
  plain: string,
  hash: string,
): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}
