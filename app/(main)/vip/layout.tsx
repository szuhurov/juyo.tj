import { notFound } from "next/navigation";
import { PAID_FEATURES_ENABLED } from "@/lib/feature-flags";

// While paid features are hidden, /vip is not part of the product: a direct
// visit or an old link gets the normal 404 instead of an unfinished plan page.
export default function VipLayout({ children }: { children: React.ReactNode }) {
  if (!PAID_FEATURES_ENABLED) notFound();
  return <>{children}</>;
}
