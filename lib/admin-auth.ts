/**
 * Рӯйхати admin-ҳо — аз ADMIN_USER_IDS (Clerk user id, ҷудо бо вергул).
 * Танҳо дар сервер истифода шавад (middleware, server component, route handler).
 */
const ADMIN_IDS = new Set(
  (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
);

export function isAdminUser(userId: string | null | undefined): boolean {
  return !!userId && ADMIN_IDS.has(userId);
}
