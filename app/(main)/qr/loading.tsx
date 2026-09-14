/**
 * A dedicated loading UI for /qr (an instant redirect to /profile?tab=qr)
 * — so Next.js doesn't fall back to the (main) group's shared loading.tsx.
 */
export default function QrRedirectLoading() {
  return null;
}
