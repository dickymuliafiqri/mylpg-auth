<script setup lang="ts">
import type { ManagedUser, UserInput } from "../composables/useUsers";

const props = defineProps<{
  /** null = mode create; objek = mode edit. */
  user: ManagedUser | null;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "saved"): void;
}>();

const { create, update } = useUsers();

const isEdit = computed(() => props.user !== null);

const form = reactive<UserInput>({
  username: props.user?.username ?? "",
  password: "",
  displayName: props.user?.displayName ?? "",
  role: props.user?.role ?? "user",
  isActive: props.user?.isActive ?? true,
  maxSessions: props.user?.maxSessions ?? 1,
  expiresAt: toDateInput(props.user?.expiresAt ?? null),
});

const error = ref("");
const saving = ref(false);

/** ISO -> value untuk <input type="datetime-local"> (lokal). */
function toDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

async function onSubmit() {
  error.value = "";
  saving.value = true;
  try {
    const payload: UserInput = {
      displayName: form.displayName,
      role: form.role,
      isActive: form.isActive,
      maxSessions: Number(form.maxSessions),
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
    };
    if (form.password) payload.password = form.password;

    if (isEdit.value && props.user) {
      await update(props.user.id, payload);
    } else {
      payload.username = form.username;
      await create(payload);
    }
    emit("saved");
  } catch (e: unknown) {
    const err = e as { data?: { message?: string }; statusMessage?: string };
    error.value = err?.data?.message ?? err?.statusMessage ?? "Gagal menyimpan.";
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 px-4"
    @click.self="emit('close')"
  >
    <div class="w-full max-w-md rounded-lg border border-gray-200 bg-white shadow-lg">
      <div class="flex items-center justify-between border-b border-gray-200 px-5 py-3">
        <h2 class="text-sm font-semibold text-gray-900">
          {{ isEdit ? "Edit User" : "Tambah User" }}
        </h2>
        <button
          class="text-gray-400 hover:text-gray-600"
          aria-label="Tutup"
          @click="emit('close')"
        >
          ✕
        </button>
      </div>

      <form class="space-y-4 px-5 py-4" @submit.prevent="onSubmit">
        <div v-if="!isEdit">
          <label class="block text-sm font-medium text-gray-700" for="f-username">
            Username
          </label>
          <input
            id="f-username"
            v-model="form.username"
            type="text"
            required
            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700" for="f-password">
            {{ isEdit ? "Reset Password (kosongkan jika tidak diubah)" : "Password" }}
          </label>
          <input
            id="f-password"
            v-model="form.password"
            type="password"
            :required="!isEdit"
            autocomplete="new-password"
            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700" for="f-display">
            Nama Tampilan
          </label>
          <input
            id="f-display"
            v-model="form.displayName"
            type="text"
            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-gray-700" for="f-role">
              Role
            </label>
            <select
              id="f-role"
              v-model="form.role"
              class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700" for="f-max">
              Maks Sesi
            </label>
            <input
              id="f-max"
              v-model="form.maxSessions"
              type="number"
              min="1"
              max="100"
              class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700" for="f-expires">
            Masa Aktif (kosong = tanpa batas)
          </label>
          <input
            id="f-expires"
            v-model="form.expiresAt"
            type="datetime-local"
            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <label class="flex items-center gap-2 text-sm text-gray-700">
          <input v-model="form.isActive" type="checkbox" class="rounded border-gray-300" />
          Akun aktif
        </label>

        <p
          v-if="error"
          class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {{ error }}
        </p>

        <div class="flex justify-end gap-2 pt-2">
          <button
            type="button"
            class="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            @click="emit('close')"
          >
            Batal
          </button>
          <button
            type="submit"
            :disabled="saving"
            class="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {{ saving ? "Menyimpan…" : "Simpan" }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
