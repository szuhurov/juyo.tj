/**
 * Саҳифаи ҷамъиятии дархости нест кардани ҳисоб — талаботи Google Play
 * Data Safety (аз дек 2023): бе воридшавӣ/насб кардани барнома низ бояд
 * роҳи дархости нест кардани маълумот вуҷуд дошта бошад.
 */
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { DeleteAccountContent } from "./delete-account-content";

const TITLES = {
  tg: { title: "Нест кардани ҳисоб", description: "Дархости нест кардани ҳисоб ва маълумоти шахсии шумо дар JUYO.TJ." },
  ru: { title: "Удаление аккаунта", description: "Запрос на удаление аккаунта и личных данных в JUYO.TJ." },
  en: { title: "Delete Account", description: "Request deletion of your account and personal data on JUYO.TJ." },
} satisfies Record<string, { title: string; description: string }>;

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const saved = cookieStore.get("juyo-locale")?.value;
  const locale = saved && saved in TITLES ? (saved as keyof typeof TITLES) : "tg";
  const { title, description } = TITLES[locale];
  return {
    title,
    description,
    alternates: { canonical: "/delete-account" },
  };
}

export default function DeleteAccountPage() {
  return <DeleteAccountContent />;
}
