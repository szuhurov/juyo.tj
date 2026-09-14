/**
 * A dedicated loading UI for /privacy — so Next.js doesn't fall back to
 * the (main) group's shared loading.tsx (an item grid skeleton built for
 * home). That skeleton looked completely wrong for this page.
 */
export default function PrivacyLoading() {
  return null;
}
