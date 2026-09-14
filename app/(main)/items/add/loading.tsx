/**
 * A dedicated loading UI for /items/add — so Next.js doesn't fall back to
 * the (main) group's shared loading.tsx (an item grid skeleton built for
 * home). That skeleton looked completely wrong for this page.
 */
export default function AddItemLoading() {
  return null;
}
