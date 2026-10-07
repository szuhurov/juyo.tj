/**
 * Paid features (VIP/VVIP/TOP plans, the /vip page, the VIP strip, TOP/VIP
 * badges, VIP notifications) are hidden for the first public release. The
 * backend (plans, subscriptions, RPCs) stays intact so the paid system can be
 * switched on later without rebuilding it.
 *
 * Only the exact string "true" turns them on. Mobile has the same flag in
 * app/lib/feature-flags.ts; keep both in the same state.
 */
export const PAID_FEATURES_ENABLED: boolean =
  process.env.NEXT_PUBLIC_PAID_FEATURES_ENABLED === "true";

/**
 * "Search by photo" (vectors made in the browser, lib/visual-search.ts). Off
 * until the visual_search migration is live and the existing photos are
 * backfilled (tools/visual-bench/backfill.ts). Same flag as
 * app/lib/feature-flags.ts (EXPO_PUBLIC_IMAGE_SEARCH).
 */
export const IMAGE_SEARCH: boolean =
  process.env.NEXT_PUBLIC_IMAGE_SEARCH === "true";
