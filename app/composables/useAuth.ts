export interface AdminUser {
  id: number;
  username: string;
  displayName: string;
  role: string;
}

/** State admin dashboard yang login (client-side). */
export function useAuth() {
  const user = useState<AdminUser | null>("admin-user", () => null);

  async function fetchMe() {
    try {
      const res = await $fetch<{ user: AdminUser }>("/api/admin/me");
      user.value = res.user;
    } catch {
      user.value = null;
    }
    return user.value;
  }

  async function login(username: string, password: string) {
    const res = await $fetch<{ ok: boolean; user: AdminUser }>("/api/admin/login", {
      method: "POST",
      body: { username, password },
    });
    user.value = res.user;
    return res;
  }

  async function logout() {
    await $fetch("/api/admin/logout", { method: "POST" });
    user.value = null;
    await navigateTo("/login");
  }

  return { user, fetchMe, login, logout };
}
