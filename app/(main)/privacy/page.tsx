/**
 * Privacy Policy page.
 * This page is required by Apple's, Google's and Facebook's policies.
 *
 * A lean Server Component: it only sets the metadata. The content lives in
 * privacy-content.tsx (a Client Component) with its own language buttons;
 * it opens in Russian by default, so the metadata is Russian too.
 */
import type { Metadata } from "next";
import { PrivacyContent } from "./privacy-content";

export const metadata: Metadata = {
  title: "Политика конфиденциальности",
  description: "Мы уважаем вашу конфиденциальность. Этот документ объясняет, какие данные мы собираем и как их используем.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return <PrivacyContent />;
}
