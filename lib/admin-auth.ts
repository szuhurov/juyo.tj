/**
 * List of admins — from ADMIN_USER_IDS (Clerk user id, comma-separated).
 * Use only on the server (middleware, server component, route handler).
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
