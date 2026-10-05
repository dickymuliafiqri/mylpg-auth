# MyLPG Auth

Panel manajemen + public API autentikasi untuk tabel user aplikasi
[`../mylpg`](../mylpg). Mengelola tabel yang **sama** (`app_users`,
`app_sessions`) di Turso remote yang dipakai mylpg, jadi akun yang dibuat di
sini langsung bisa dipakai login di mylpg.

## Teknologi

- **Nuxt 4** (Vue 3, SSR) + **Nitro** server
- **Drizzle ORM** + **Turso** (`@libsql/client`) — remote libSQL
- **nuxt-auth-utils** — cookie session untuk panel admin
- **bcryptjs** — hashing password bcrypt (kompatibel dengan `Bun.password` di mylpg)
- **Tailwind CSS v4** — desain ringan, solid, tanpa glassmorphism
- Jalan di **Node** maupun **Bun**

## Fitur

- **CRUD user**: buat, lihat, ubah, hapus akun; reset password; atur role,
  status aktif, masa aktif (lisensi), dan batas sesi (anti-sharing).
- **Login admin** dengan **rate limit anti brute-force** (5 gagal / 5 menit per
  IP+username → blokir 15 menit, header `Retry-After`).
- **Public API** (`/api/public/*`) untuk dipanggil mylpg: login, verify, logout.
- **Auto-create table** saat start (idempoten, `CREATE TABLE IF NOT EXISTS`).
- **Spec OpenAPI** di `/api/openapi.json` + viewer di `/docs`.
- **Seed admin** otomatis dari `APP_USERNAME`/`APP_PASSWORD` bila tabel kosong.

## Setup

1. Salin env dan isi kredensial Turso (samakan dengan `../mylpg/.env`):

   ```bash
   cp .env.example .env
   ```

   | Variabel | Keterangan |
   | --- | --- |
   | `TURSO_DATABASE_URL` | URL libSQL Turso (sama dengan mylpg) |
   | `TURSO_DATABASE_TOKEN` | Token auth Turso |
   | `NUXT_SESSION_PASSWORD` | ≥ 32 char, enkripsi cookie admin (`openssl rand -hex 32`) |
   | `APP_USERNAME` / `APP_PASSWORD` | Seed admin pertama (sekali, saat tabel kosong) |
   | `PUBLIC_API_KEY` | Opsional. Jika diisi, `/api/public/*` wajib header `x-api-key` |

2. Install & jalankan:

   ```bash
   bun install
   bun run dev        # pengembangan di http://localhost:3000
   # atau produksi:
   bun run build
   node .output/server/index.mjs   # atau: bun run .output/server/index.mjs
   ```

3. Buka `http://localhost:3000`, login dengan `APP_USERNAME`/`APP_PASSWORD`.

## Skema tabel

Identik dengan `../mylpg/server/utils/auth-db/schema.ts`:

```
app_users(id, username, passwordHash, displayName, role, isActive,
          expiresAt, maxSessions, lastLoginAt, createdAt)
app_sessions(id, userId, ip, userAgent, createdAt, lastSeenAt,
             expiresAt, revokedAt)
```

- `role`: `admin` (boleh kelola & masuk panel) atau `user` (hanya pakai mylpg).
- `expiresAt`: masa sewa; `null` = tanpa batas. Lewat waktu → login ditolak.
- `maxSessions`: batas sesi aktif bersamaan (anti-sharing). `1` = tak boleh
  dipinjamkan.

## Public API — integrasi dengan mylpg

Semua endpoint menerima/mengembalikan JSON. Jika `PUBLIC_API_KEY` diisi, kirim
header `x-api-key: <kunci>`.

### `POST /api/public/login`

```jsonc
// request
{ "username": "budi", "password": "rahasia" }
// 200
{ "ok": true, "sessionId": "uuid", "expiresAt": "ISO", "user": { "id": 1, "username": "budi", "displayName": "...", "role": "user" } }
```

Error: `401` kredensial salah · `403` nonaktif/masa habis · `409` batas sesi
tercapai · `429` rate limit.

### `POST /api/public/verify`

```jsonc
// request
{ "sessionId": "uuid" }
// 200
{ "ok": true, "expiresAt": "ISO", "user": { ... } }
```

Panggil tiap request terproteksi. Memperpanjang sesi (sliding expiry).

### `POST /api/public/logout`

```jsonc
{ "sessionId": "uuid" }   // -> { "ok": true }
```

### Contoh pemakaian dari mylpg

```ts
const base = "http://localhost:3000";
const headers = { "content-type": "application/json", "x-api-key": process.env.PUBLIC_API_KEY ?? "" };

// login
const r = await $fetch(`${base}/api/public/login`, {
  method: "POST", headers, body: { username, password },
});
// simpan r.sessionId (mis. di cookie/keychain), lalu tiap request:
await $fetch(`${base}/api/public/verify`, {
  method: "POST", headers, body: { sessionId: r.sessionId },
});
```

## Endpoint manajemen (butuh sesi admin)

| Method | Path | Fungsi |
| --- | --- | --- |
| POST | `/api/admin/login` | Login panel (rate-limited) |
| POST | `/api/admin/logout` | Logout panel |
| GET | `/api/admin/me` | Info admin saat ini |
| GET | `/api/users` | List user + jumlah sesi aktif |
| POST | `/api/users` | Buat user |
| GET | `/api/users/:id` | Detail user + sesi aktif |
| PATCH | `/api/users/:id` | Update / reset password |
| DELETE | `/api/users/:id` | Hapus user |
| DELETE | `/api/users/:id/sessions` | Cabut semua sesi mylpg user |
| GET | `/api/openapi.json` | Spec OpenAPI 3.1 |

## Catatan keamanan

- Password di-hash bcrypt (cost 10), format kompatibel dengan `Bun.password`
  milik mylpg — login lintas-app konsisten.
- Rate limit disimpan di memori proses (cukup untuk satu instance). Untuk
  multi-instance, ganti store di `server/utils/rate-limit.ts` ke Redis/Turso.
- Cookie session admin memakai flag `Secure` — di produksi layani lewat HTTPS.
- Jangan commit `.env`. Token Turso bersifat rahasia.
```
