import tailwindcss from "@tailwindcss/vite";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-01-01",
  devtools: { enabled: false },

  modules: ["nuxt-auth-utils"],

  css: ["~/assets/css/main.css"],

  vite: {
    plugins: [tailwindcss()],
  },

  runtimeConfig: {
    // Server-only. Diisi dari env di runtime.
    tursoDatabaseUrl: process.env.TURSO_DATABASE_URL ?? "",
    tursoDatabaseToken: process.env.TURSO_DATABASE_TOKEN ?? "",
    // Seed admin dashboard pertama (kalau app_users kosong).
    appUsername: process.env.APP_USERNAME ?? "",
    appPassword: process.env.APP_PASSWORD ?? "",
    // Shared secret untuk melindungi sebagian public API verify (opsional).
    publicApiKey: process.env.PUBLIC_API_KEY ?? "",
  },

  nitro: {
    // @libsql/client menarik dependensi (mis. @libsql/isomorphic-ws) yang tidak
    // ikut ter-bundle rapi oleh Nitro. Tandai sebagai eksternal supaya di-resolve
    // dari node_modules saat runtime (butuh node_modules ikut saat deploy).
    externals: {
      external: ["@libsql/client", "@libsql/client/node", "libsql"],
    },
  },

  app: {
    head: {
      title: "MyLPG Auth — User Management",
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        {
          name: "description",
          content: "Dashboard manajemen user & API autentikasi untuk aplikasi MyLPG.",
        },
      ],
      htmlAttrs: { lang: "id" },
    },
  },
});
