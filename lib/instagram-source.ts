/**
 * Listings the admin posts for people who wrote to JUYO on Instagram.
 *
 * There is no account behind such a listing. Each person gets a small profile
 * row (no schema change, and every client already shows first name + the line
 * under it): the first line says where the listing came from, the line under
 * it is the person's own name.
 */
export const INSTAGRAM_PROFILE_PREFIX = "instagram_";
export const INSTAGRAM_PROFILE_NAME = "Аз Instagram-и juyo";

export function isInstagramProfileId(id: string | null | undefined): boolean {
  return !!id && id.startsWith(INSTAGRAM_PROFILE_PREFIX);
}
