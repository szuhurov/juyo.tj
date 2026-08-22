/**
 * Масири кӯтоҳи QR: `/q/<code>` → `/qr/<id>`.
 *
 * Стикерҳо маҳз ба ин суроға ишора мекунанд. Кӯтоҳии он сабаби техникӣ
 * дорад, на зебоӣ: суроғаи дарози `/qr/user_3Dqp9UtdA…` (51 ҳарф) QR-и
 * 41×41 месохт ва нуқтаҳояш майда мебаромаданд. Бо рамзи 6-ҳарфа он
 * 29×29 мешавад — нуқтаҳо 41% калонтар, бе кам кардани сатҳи ҳимоя.
 *
 * Ин ҷо танҳо равонакунӣ аст, то саҳифаи тамос ЯК нусха бошад: ҳар
 * тағйири он ҷо ба ҳарду масир мерасад.
 *
 * Стикерҳои кӯҳна кор мекунанд — `/qr/<id>` нест нашудааст.
 */
import { redirect, notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";

interface Props {
  params: Promise<{ code: string }>;
}

// Рамз → ID. Кэш 5 дақиқа: рамз ҳаргиз тағйир намеёбад, пас ҳар скан
// набояд ба пойгоҳ равад.
const getCachedId = unstable_cache(
  async (code: string) => {
    const { data } = await supabase.rpc("get_id_by_qr_code", { p_code: code });
    return (data as string | null) ?? null;
  },
  ["qr-code-id"],
  { revalidate: 300 },
);

export default async function ShortQrPage({ params }: Props) {
  const { code } = await params;

  // Алифбои рамз маълум аст — санҷиши шакл пеш аз ҳар дархости пойгоҳ
  // онро аз скани тасодуфии суроғаҳои бегона ҳимоя мекунад.
  if (!/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/i.test(code)) notFound();

  const id = await getCachedId(code.toUpperCase());
  if (!id) notFound();

  redirect(`/qr/${id}`);
}
