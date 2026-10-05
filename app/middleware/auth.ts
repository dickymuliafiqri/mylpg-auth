/** Lindungi halaman dashboard: harus admin login, kalau tidak -> /login. */
export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === "/login") return;
  const { user, fetchMe } = useAuth();
  if (!user.value) {
    const me = await fetchMe();
    if (!me) return navigateTo("/login");
  }
});
