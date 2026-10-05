/**
 * Spec OpenAPI 3.1 untuk mempermudah integrasi aplikasi ../mylpg (dan klien
 * lain) ke public API autentikasi. Disajikan sebagai JSON di /api/openapi.json
 * dan dirender oleh halaman /docs.
 */
export default defineEventHandler((event) => {
  setResponseHeader(event, "Content-Type", "application/json; charset=utf-8");

  const spec = {
    openapi: "3.1.0",
    info: {
      title: "MyLPG Auth API",
      version: "1.0.0",
      description:
        "Public authentication API untuk aplikasi MyLPG + endpoint manajemen user " +
        "(CRUD) yang dilindungi sesi admin. Tabel auth (app_users, app_sessions) " +
        "berada di Turso remote dan dibagi dengan aplikasi mylpg.",
    },
    servers: [{ url: "/", description: "Server ini" }],
    tags: [
      { name: "public", description: "Dipanggil oleh aplikasi mylpg." },
      { name: "admin-auth", description: "Login panel manajemen." },
      { name: "users", description: "CRUD user (butuh sesi admin)." },
    ],
    components: {
      securitySchemes: {
        apiKey: {
          type: "apiKey",
          in: "header",
          name: "x-api-key",
          description:
            "Wajib untuk /api/public/* bila PUBLIC_API_KEY diset di server. " +
            "Kosongkan env untuk menonaktifkan.",
        },
        adminCookie: {
          type: "apiKey",
          in: "cookie",
          name: "nuxt-session",
          description: "Cookie sesi admin dari POST /api/admin/login.",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            statusCode: { type: "integer", example: 401 },
            message: { type: "string", example: "Username atau password salah." },
          },
        },
        PublicLoginRequest: {
          type: "object",
          required: ["username", "password"],
          properties: {
            username: { type: "string", example: "budi" },
            password: { type: "string", format: "password", example: "rahasia123" },
          },
        },
        PublicLoginResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean", example: true },
            sessionId: {
              type: "string",
              format: "uuid",
              description: "Simpan & kirim kembali saat verify/logout.",
            },
            expiresAt: { type: "string", format: "date-time", nullable: true },
            user: { $ref: "#/components/schemas/PublicUser" },
          },
        },
        PublicUser: {
          type: "object",
          properties: {
            id: { type: "integer", example: 12 },
            username: { type: "string", example: "budi" },
            displayName: { type: "string", example: "Budi Merchant" },
            role: { type: "string", enum: ["admin", "user"], example: "user" },
          },
        },
        VerifyRequest: {
          type: "object",
          required: ["sessionId"],
          properties: { sessionId: { type: "string", format: "uuid" } },
        },
        VerifyResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean", example: true },
            expiresAt: { type: "string", format: "date-time", nullable: true },
            user: {
              allOf: [
                { $ref: "#/components/schemas/PublicUser" },
                {
                  type: "object",
                  properties: {
                    expiresAt: {
                      type: "string",
                      format: "date-time",
                      nullable: true,
                    },
                  },
                },
              ],
            },
          },
        },
        User: {
          type: "object",
          properties: {
            id: { type: "integer" },
            username: { type: "string" },
            displayName: { type: "string" },
            role: { type: "string", enum: ["admin", "user"] },
            isActive: { type: "boolean" },
            expiresAt: { type: "string", format: "date-time", nullable: true },
            maxSessions: { type: "integer", example: 1 },
            lastLoginAt: { type: "string", format: "date-time", nullable: true },
            createdAt: { type: "string", format: "date-time", nullable: true },
            activeSessions: { type: "integer", example: 0 },
          },
        },
        CreateUserRequest: {
          type: "object",
          required: ["username", "password"],
          properties: {
            username: { type: "string", minLength: 3, maxLength: 64 },
            password: { type: "string", minLength: 6, maxLength: 128 },
            displayName: { type: "string" },
            role: { type: "string", enum: ["admin", "user"], default: "user" },
            isActive: { type: "boolean", default: true },
            expiresAt: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "null = tanpa batas waktu.",
            },
            maxSessions: { type: "integer", minimum: 1, maximum: 100, default: 1 },
          },
        },
        UpdateUserRequest: {
          type: "object",
          description: "Semua field opsional. password diisi hanya untuk reset.",
          properties: {
            password: { type: "string", minLength: 6, maxLength: 128 },
            displayName: { type: "string" },
            role: { type: "string", enum: ["admin", "user"] },
            isActive: { type: "boolean" },
            expiresAt: { type: "string", format: "date-time", nullable: true },
            maxSessions: { type: "integer", minimum: 1, maximum: 100 },
          },
        },
        LoginRequest: {
          type: "object",
          required: ["username", "password"],
          properties: {
            username: { type: "string" },
            password: { type: "string", format: "password" },
          },
        },
      },
    },
    paths: {
      "/api/public/login": {
        post: {
          tags: ["public"],
          summary: "Login user mylpg",
          description:
            "Verifikasi kredensial, cek lisensi (isActive + expiresAt), anti-sharing " +
            "(maxSessions), lalu buat sesi dan kembalikan sessionId. Rate-limited: " +
            "5 gagal / 5 menit per (IP + username) → blokir 15 menit.",
          security: [{ apiKey: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PublicLoginRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "Berhasil",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/PublicLoginResponse" },
                },
              },
            },
            "400": { description: "Input kurang" },
            "401": { description: "Kredensial salah" },
            "403": { description: "Nonaktif / masa sewa habis" },
            "409": { description: "Batas sesi tercapai (anti-sharing)" },
            "429": { description: "Terkena rate limit (lihat header Retry-After)" },
          },
        },
      },
      "/api/public/verify": {
        post: {
          tags: ["public"],
          summary: "Verifikasi sesi mylpg",
          description:
            "Validasi sessionId tiap request terproteksi. Memperbarui lastSeenAt " +
            "dan memperpanjang expiry (sliding).",
          security: [{ apiKey: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/VerifyRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "Sesi valid",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/VerifyResponse" },
                },
              },
            },
            "401": { description: "Sesi tidak valid / dicabut / kedaluwarsa" },
            "403": { description: "Akun nonaktif / masa sewa habis" },
          },
        },
      },
      "/api/public/logout": {
        post: {
          tags: ["public"],
          summary: "Logout (revoke sesi) mylpg",
          security: [{ apiKey: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/VerifyRequest" },
              },
            },
          },
          responses: { "200": { description: "Berhasil dicabut" } },
        },
      },
      "/api/admin/login": {
        post: {
          tags: ["admin-auth"],
          summary: "Login panel admin",
          description: "Hanya role admin. Rate-limited sama seperti public login.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LoginRequest" },
              },
            },
          },
          responses: {
            "200": { description: "Berhasil, set cookie sesi admin" },
            "401": { description: "Kredensial salah" },
            "403": { description: "Bukan admin / nonaktif" },
            "429": { description: "Rate limit" },
          },
        },
      },
      "/api/admin/logout": {
        post: {
          tags: ["admin-auth"],
          summary: "Logout panel admin",
          security: [{ adminCookie: [] }],
          responses: { "200": { description: "Berhasil" } },
        },
      },
      "/api/admin/me": {
        get: {
          tags: ["admin-auth"],
          summary: "Info admin saat ini",
          security: [{ adminCookie: [] }],
          responses: {
            "200": { description: "Data admin" },
            "401": { description: "Belum login" },
          },
        },
      },
      "/api/users": {
        get: {
          tags: ["users"],
          summary: "List user",
          security: [{ adminCookie: [] }],
          responses: {
            "200": {
              description: "Daftar user",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      users: {
                        type: "array",
                        items: { $ref: "#/components/schemas/User" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ["users"],
          summary: "Buat user",
          security: [{ adminCookie: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateUserRequest" },
              },
            },
          },
          responses: {
            "200": { description: "Dibuat" },
            "409": { description: "Username sudah dipakai" },
          },
        },
      },
      "/api/users/{id}": {
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
        ],
        get: {
          tags: ["users"],
          summary: "Detail user + sesi aktif",
          security: [{ adminCookie: [] }],
          responses: { "200": { description: "OK" }, "404": { description: "Tidak ada" } },
        },
        patch: {
          tags: ["users"],
          summary: "Update user / reset password",
          security: [{ adminCookie: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpdateUserRequest" },
              },
            },
          },
          responses: { "200": { description: "OK" }, "404": { description: "Tidak ada" } },
        },
        delete: {
          tags: ["users"],
          summary: "Hapus user",
          security: [{ adminCookie: [] }],
          responses: { "200": { description: "OK" }, "404": { description: "Tidak ada" } },
        },
      },
      "/api/users/{id}/sessions": {
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
        ],
        delete: {
          tags: ["users"],
          summary: "Cabut semua sesi mylpg milik user",
          security: [{ adminCookie: [] }],
          responses: { "200": { description: "OK" } },
        },
      },
    },
  };

  return spec;
});
