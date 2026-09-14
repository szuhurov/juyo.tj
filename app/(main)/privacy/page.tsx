/**
 * Privacy Policy page.
 * This page is required by Facebook and Google's policies.
 *
 * A LEAN Server Component: it only builds the metadata (title/description)
 * from the language cookie — the actual content lives in privacy-content.tsx
 * (a Client Component), so switching the language from the header (without
 * navigation) works instantly.
 */
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { PrivacyContent } from "./privacy-content";

const TITLES = {
  tg: { title: "Сиёсати махфият", description: "Мо ба махфияти шумо эҳтиром мегузорем. Ин ҳуҷҷат мефаҳмонад, ки кадом маълумотро мо ҷамъоварӣ мекунем ва чӣ гуна онро истифода мебарем." },
  ru: { title: "Политика конфиденциальности", description: "Мы уважаем вашу конфиденциальность. Этот документ объясняет, какие данные мы собираем и как их используем." },
  en: { title: "Privacy Policy", description: "We respect your privacy. This document explains what data we collect and how we use it." },
} satisfies Record<string, { title: string; description: string }>;

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const saved = cookieStore.get("juyo-locale")?.value;
  const locale = saved && saved in TITLES ? (saved as keyof typeof TITLES) : "tg";
  const { title, description } = TITLES[locale];
  return {
    title,
    description,
    alternates: { canonical: "/privacy" },
  };
}

export default function PrivacyPage() {
  return <PrivacyContent />;
}
