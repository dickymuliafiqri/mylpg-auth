/**
 * Rate limiter in-memory sederhana untuk menahan brute-force login.
 *
 * Strategi: hitung percobaan GAGAL per kunci (IP + username) dalam jendela
 * waktu. Lewat ambang -> diblokir sampai jendela reset / cooldown habis.
 * Login sukses mereset counter kunci tsb.
 *
 * Catatan: state ada di memori proses. Cukup untuk satu instance. Untuk
 * multi-instance, ganti store ke Redis/Turso dengan antarmuka yang sama.
 */

interface Bucket {
  /** Jumlah percobaan gagal dalam jendela berjalan. */
  fails: number;
  /** Kapan jendela berjalan dimulai (ms epoch). */
  windowStart: number;
  /** Kapan blokir berakhir (ms epoch), 0 = tidak diblokir. */
  blockedUntil: number;
}

export interface RateLimitConfig {
  /** Maks percobaan gagal sebelum diblokir. */
  maxFails: number;
  /** Panjang jendela penghitungan (ms). */
  windowMs: number;
  /** Lama blokir setelah ambang terlampaui (ms). */
  blockMs: number;
}

export const LOGIN_RATE_LIMIT: RateLimitConfig = {
  maxFails: 5,
  windowMs: 1000 * 60 * 5, // 5 menit
  blockMs: 1000 * 60 * 15, // blokir 15 menit
};

const buckets = new Map<string, Bucket>();

// Bersihkan bucket basi secara berkala agar memori tidak tumbuh.
const CLEANUP_INTERVAL_MS = 1000 * 60 * 10;
let lastCleanup = Date.now();

function cleanup(now: number, cfg: RateLimitConfig) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, b] of buckets) {
    const idle = now - b.windowStart;
    if (b.blockedUntil < now && idle > cfg.windowMs) {
      buckets.delete(key);
    }
  }
}

export interface RateLimitState {
  blocked: boolean;
  /** Detik tersisa sampai boleh mencoba lagi (saat blocked). */
  retryAfterSec: number;
  /** Sisa percobaan sebelum terblokir (saat tidak blocked). */
  remaining: number;
}

/** Cek status TANPA menambah counter. Panggil sebelum verifikasi password. */
export function checkRateLimit(
  key: string,
  cfg: RateLimitConfig = LOGIN_RATE_LIMIT,
): RateLimitState {
  const now = Date.now();
  cleanup(now, cfg);
  const b = buckets.get(key);
  if (!b) return { blocked: false, retryAfterSec: 0, remaining: cfg.maxFails };

  if (b.blockedUntil > now) {
    return {
      blocked: true,
      retryAfterSec: Math.ceil((b.blockedUntil - now) / 1000),
      remaining: 0,
    };
  }

  // Jendela sudah lewat -> anggap reset.
  if (now - b.windowStart > cfg.windowMs) {
    return { blocked: false, retryAfterSec: 0, remaining: cfg.maxFails };
  }

  return {
    blocked: false,
    retryAfterSec: 0,
    remaining: Math.max(0, cfg.maxFails - b.fails),
  };
}

/** Catat satu percobaan GAGAL. Mengembalikan status terbaru. */
export function recordFailure(
  key: string,
  cfg: RateLimitConfig = LOGIN_RATE_LIMIT,
): RateLimitState {
  const now = Date.now();
  let b = buckets.get(key);

  if (!b || now - b.windowStart > cfg.windowMs) {
    b = { fails: 0, windowStart: now, blockedUntil: 0 };
  }

  b.fails += 1;
  if (b.fails >= cfg.maxFails) {
    b.blockedUntil = now + cfg.blockMs;
  }
  buckets.set(key, b);

  if (b.blockedUntil > now) {
    return {
      blocked: true,
      retryAfterSec: Math.ceil((b.blockedUntil - now) / 1000),
      remaining: 0,
    };
  }
  return {
    blocked: false,
    retryAfterSec: 0,
    remaining: Math.max(0, cfg.maxFails - b.fails),
  };
}

/** Reset counter untuk kunci (dipanggil setelah login sukses). */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

/** Ambil IP klien dari header umum proxy. */
export function clientIp(event: {
  node?: { req?: { socket?: { remoteAddress?: string } } };
}): string {
  // Dipakai lewat helper h3 di handler; fallback di sini jarang terpakai.
  return event.node?.req?.socket?.remoteAddress ?? "unknown";
}
