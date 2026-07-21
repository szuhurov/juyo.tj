/**
 * Саҳифаи сиёсати махфият (Privacy Policy).
 * Ин саҳифа барои талаботи Facebook ва Google ҳатмӣ мебошад.
 *
 * Server Component-и НОЗУК: танҳо metadata (title/description)-ро аз
 * cookie-и забон месозад — мӯҳтавои воқеӣ дар privacy-content.tsx (Client
 * Component) аст, то ивази забон аз header (бе navigation) фавран кор кунад.
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
