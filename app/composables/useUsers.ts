export interface ManagedUser {
  id: number;
  username: string;
  displayName: string;
  role: string;
  isActive: boolean;
  expiresAt: string | null;
  maxSessions: number;
  lastLoginAt: string | null;
  createdAt: string | null;
  activeSessions: number;
}

export interface UserInput {
  username?: string;
  password?: string;
  displayName?: string;
  role?: string;
  isActive?: boolean;
  expiresAt?: string | null;
  maxSessions?: number;
}

export function useUsers() {
  async function list(): Promise<ManagedUser[]> {
    const res = await $fetch<{ users: ManagedUser[] }>("/api/users");
    return res.users;
  }

  async function create(input: UserInput) {
    return $fetch("/api/users", { method: "POST", body: input });
  }

  async function update(id: number, input: UserInput) {
    return $fetch(`/api/users/${id}`, { method: "PATCH", body: input });
  }

  async function remove(id: number) {
    return $fetch(`/api/users/${id}`, { method: "DELETE" });
  }

  async function revokeSessions(id: number) {
    return $fetch(`/api/users/${id}/sessions`, { method: "DELETE" });
  }

  return { list, create, update, remove, revokeSessions };
}
