<script setup lang="ts">
definePageMeta({ middleware: "auth" });

// Render Swagger UI dari CDN, menunjuk ke /api/openapi.json.
useHead({
  link: [
    {
      rel: "stylesheet",
      href: "https://unpkg.com/swagger-ui-dist@5/swagger-ui.css",
    },
  ],
  script: [
    {
      src: "https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js",
      defer: true,
    },
  ],
});

onMounted(() => {
  const tryInit = () => {
    const g = window as unknown as {
      SwaggerUIBundle?: (opts: Record<string, unknown>) => void;
    };
    if (g.SwaggerUIBundle) {
      g.SwaggerUIBundle({
        url: "/api/openapi.json",
        dom_id: "#swagger",
        deepLinking: true,
      });
    } else {
      setTimeout(tryInit, 150);
    }
  };
  tryInit();
});
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />
    <main class="mx-auto max-w-5xl px-4 py-6">
      <div class="mb-4">
        <h1 class="text-lg font-semibold text-gray-900">API Docs</h1>
        <p class="text-sm text-gray-500">
          Spec OpenAPI untuk integrasi aplikasi mylpg. Raw:
          <a href="/api/openapi.json" class="text-brand-600 underline" target="_blank">
            /api/openapi.json
          </a>
        </p>
      </div>
      <div class="rounded-lg border border-gray-200 bg-white p-2">
        <div id="swagger" />
      </div>
    </main>
  </div>
</template>
