<script setup lang="ts">
definePageMeta({ middleware: "auth" });

const { login } = useAuth();
const username = ref("");
const password = ref("");
const error = ref("");
const loading = ref(false);

async function onSubmit() {
  error.value = "";
  loading.value = true;
  try {
    await login(username.value, password.value);
    await navigateTo("/");
  } catch (e: unknown) {
    const err = e as { data?: { message?: string }; statusMessage?: string };
    error.value =
      err?.data?.message ?? err?.statusMessage ?? "Login gagal. Coba lagi.";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="min-h-screen flex items-center justify-center px-4">
    <div class="w-full max-w-sm">
      <div class="mb-6 text-center">
        <h1 class="text-xl font-semibold text-gray-900">MyLPG Auth</h1>
        <p class="mt-1 text-sm text-gray-500">Panel manajemen user</p>
      </div>

      <form
        class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
        @submit.prevent="onSubmit"
      >
        <label class="block text-sm font-medium text-gray-700" for="username">
          Username
        </label>
        <input
          id="username"
          v-model="username"
          type="text"
          autocomplete="username"
          required
          class="mt-1 mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500"
        />

        <label class="block text-sm font-medium text-gray-700" for="password">
          Password
        </label>
        <input
          id="password"
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
          class="mt-1 mb-4 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500"
        />

        <p
          v-if="error"
          class="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {{ error }}
        </p>

        <button
          type="submit"
          :disabled="loading"
          class="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {{ loading ? "Memproses…" : "Masuk" }}
        </button>
      </form>

      <p class="mt-4 text-center text-xs text-gray-400">
        Dilindungi rate limit anti brute-force.
      </p>
    </div>
  </main>
</template>
