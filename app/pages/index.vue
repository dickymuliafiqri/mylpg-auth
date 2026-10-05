<script setup lang="ts">
import type { ManagedUser } from "../composables/useUsers";

definePageMeta({ middleware: "auth" });

const { list, remove, revokeSessions } = useUsers();

const users = ref<ManagedUser[]>([]);
const loading = ref(true);
const error = ref("");
const query = ref("");

const showModal = ref(false);
const editing = ref<ManagedUser | null>(null);

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return users.value;
  return users.value.filter(
    (u) =>
      u.username.toLowerCase().includes(q) ||
      u.displayName.toLowerCase().includes(q),
  );
});

async function load() {
  loading.value = true;
  error.value = "";
  try {
    users.value = await list();
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } };
    error.value = err?.data?.message ?? "Gagal memuat user.";
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editing.value = null;
  showModal.value = true;
}

function openEdit(u: ManagedUser) {
  editing.value = u;
  showModal.value = true;
}

async function onSaved() {
  showModal.value = false;
  await load();
}

async function onDelete(u: ManagedUser) {
  if (!confirm(`Hapus user "${u.username}"? Tindakan ini permanen.`)) return;
  try {
    await remove(u.id);
    await load();
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } };
    alert(err?.data?.message ?? "Gagal menghapus.");
  }
}

async function onRevoke(u: ManagedUser) {
  if (!confirm(`Cabut semua sesi aktif "${u.username}"?`)) return;
  try {
    await revokeSessions(u.id);
    await load();
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } };
    alert(err?.data?.message ?? "Gagal mencabut sesi.");
  }
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function isExpired(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() <= Date.now();
}

onMounted(load);
</script>

<template>
  <div class="min-h-screen">
    <AppHeader />

    <main class="mx-auto max-w-5xl px-4 py-6">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-lg font-semibold text-gray-900">User Aplikasi MyLPG</h1>
          <p class="text-sm text-gray-500">
            Kelola akun login & lisensi untuk aplikasi mylpg.
          </p>
        </div>
        <button
          class="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          @click="openCreate"
        >
          + Tambah User
        </button>
      </div>

      <div class="mb-3">
        <input
          v-model="query"
          type="search"
          placeholder="Cari username atau nama…"
          class="w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div
        v-if="error"
        class="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
      >
        {{ error }}
      </div>

      <div class="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table class="min-w-full divide-y divide-gray-200 text-sm">
          <thead class="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
            <tr>
              <th class="px-4 py-3">User</th>
              <th class="px-4 py-3">Role</th>
              <th class="px-4 py-3">Status</th>
              <th class="px-4 py-3">Masa Aktif</th>
              <th class="px-4 py-3">Sesi</th>
              <th class="px-4 py-3">Login Terakhir</th>
              <th class="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-if="loading">
              <td colspan="7" class="px-4 py-8 text-center text-gray-400">Memuat…</td>
            </tr>
            <tr v-else-if="filtered.length === 0">
              <td colspan="7" class="px-4 py-8 text-center text-gray-400">
                Belum ada user.
              </td>
            </tr>
            <tr v-for="u in filtered" :key="u.id" class="hover:bg-gray-50">
              <td class="px-4 py-3">
                <div class="font-medium text-gray-900">{{ u.username }}</div>
                <div class="text-xs text-gray-500">{{ u.displayName || "—" }}</div>
              </td>
              <td class="px-4 py-3">
                <span
                  class="rounded px-2 py-0.5 text-xs font-medium"
                  :class="
                    u.role === 'admin'
                      ? 'bg-brand-100 text-brand-700'
                      : 'bg-gray-100 text-gray-600'
                  "
                >
                  {{ u.role }}
                </span>
              </td>
              <td class="px-4 py-3">
                <span
                  class="rounded px-2 py-0.5 text-xs font-medium"
                  :class="
                    u.isActive
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-200 text-gray-600'
                  "
                >
                  {{ u.isActive ? "Aktif" : "Nonaktif" }}
                </span>
              </td>
              <td class="px-4 py-3">
                <span :class="isExpired(u.expiresAt) ? 'text-red-600' : 'text-gray-700'">
                  {{ u.expiresAt ? fmtDate(u.expiresAt) : "Tanpa batas" }}
                </span>
              </td>
              <td class="px-4 py-3 text-gray-700">
                {{ u.activeSessions }} / {{ u.maxSessions }}
              </td>
              <td class="px-4 py-3 text-gray-500">{{ fmtDate(u.lastLoginAt) }}</td>
              <td class="px-4 py-3">
                <div class="flex justify-end gap-2 text-xs">
                  <button
                    class="rounded border border-gray-300 px-2 py-1 text-gray-700 hover:bg-gray-100"
                    @click="openEdit(u)"
                  >
                    Edit
                  </button>
                  <button
                    v-if="u.activeSessions > 0"
                    class="rounded border border-gray-300 px-2 py-1 text-gray-700 hover:bg-gray-100"
                    @click="onRevoke(u)"
                  >
                    Cabut Sesi
                  </button>
                  <button
                    class="rounded border border-red-300 px-2 py-1 text-red-600 hover:bg-red-50"
                    @click="onDelete(u)"
                  >
                    Hapus
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>

    <UserFormModal
      v-if="showModal"
      :user="editing"
      @close="showModal = false"
      @saved="onSaved"
    />
  </div>
</template>
