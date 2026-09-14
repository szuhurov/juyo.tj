/**
 * A dedicated loading UI for /profile — so Next.js doesn't fall back to
 * the (main) group's shared loading.tsx (an item grid skeleton built for
 * home). That looked completely wrong for the QR/Info tabs — a "mismatched"
 * skeleton would flash before the correct skeleton of profile/page.tsx
 * itself (which is already handled via the profileLoading/postsLoading
 * state). Leaving this empty eliminates that double flash — profile/page.tsx
 * shows the correct skeleton immediately on its own.
 */
export default function ProfileLoading() {
  return null;
}
