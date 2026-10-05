<script setup lang="ts">
const { user, logout } = useAuth();
</script>

<template>
  <header class="border-b border-gray-200 bg-white">
    <div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
      <div class="flex items-center gap-3">
        <NuxtLink to="/" class="text-sm font-semibold text-gray-900">
          MyLPG Auth
        </NuxtLink>
        <span class="text-gray-300">/</span>
        <span class="text-sm text-gray-500">Manajemen User</span>
      </div>
      <nav class="flex items-center gap-4 text-sm">
        <NuxtLink to="/" class="text-gray-600 hover:text-gray-900">Users</NuxtLink>
        <NuxtLink to="/docs" class="text-gray-600 hover:text-gray-900">API Docs</NuxtLink>
        <span v-if="user" class="text-gray-400">·</span>
        <span v-if="user" class="text-gray-500">{{ user.username }}</span>
        <button
          class="rounded-md border border-gray-300 px-3 py-1 text-gray-700 hover:bg-gray-50"
          @click="logout"
        >
          Logout
        </button>
      </nav>
    </div>
  </header>
</template>
