/**
 * Short QR path: `/q/<code>` → `/qr/<id>`.
 *
 * Stickers point specifically to this address. Its shortness has a
 * technical reason, not an aesthetic one: the long address
 * `/qr/user_3Dqp9UtdA…` (51 characters) produced a 41×41 QR whose dots
 * came out tiny. With a 6-character code it becomes 29×29 — dots are
 * 41% bigger, without reducing the error-correction level.
 *
 * This is purely a redirect, so the contact page stays a SINGLE copy: any
 * change there reaches both paths.
 *
 * Old stickers still work — `/qr/<id>` hasn't been removed.
 */
import { redirect, notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";

interface Props {
  params: Promise<{ code: string }>;
}

// Code → ID. Cached for 5 minutes: the code never changes, so not every
// scan should have to hit the database. `supabaseAdmin` — after
// migration 20260824020000 this RPC was also REVOKEd from anon/authenticated
// (see the detailed comment in app/qr/[id]/page.tsx).
const getCachedId = unstable_cache(
  async (code: string) => {
    const { data } = await supabaseAdmin.rpc("get_id_by_qr_code", { p_code: code });
    return (data as string | null) ?? null;
  },
  ["qr-code-id"],
  { revalidate: 300 },
);

export default async function ShortQrPage({ params }: Props) {
  const { code } = await params;

  // The code's alphabet is known — validating its shape before any database
  // request protects it from random scans of unrelated addresses.
  if (!/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/i.test(code)) notFound();

  const id = await getCachedId(code.toUpperCase());
  if (!id) notFound();

  redirect(`/qr/${id}`);
}
