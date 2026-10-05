import { requireAdmin } from "../../utils/admin-auth";

export default defineEventHandler(async (event) => {
  const user = await requireAdmin(event);
  return { user };
});
