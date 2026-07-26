import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getErrorMessage } from "@/lib/error-utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Дархости нест кардани маълумот — талаботи Google Play Data Safety
 * (аз дек 2023): корбар бояд тавонад ин корро тавассути веб дархост кунад,
 * бе воридшавӣ/насб кардани барнома (масалан агар парол гум шуда бошад).
 * Ин route ҳамеша ба admin мефиристад (/admin/deletion-requests), на воситаи
 * коркарди худкор — то суиистифода (нест кардани ҳисоби дигарон бо email-и
 * онҳо) пешгирӣ шавад, admin шахсиятро тасдиқ мекунад пеш аз коркард.
 */
export async function POST(req: NextRequest) {
  try {
    const { email, note } = await req.json();
    if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("account_deletion_requests").insert({
      email: email.trim().toLowerCase(),
      note: typeof note === "string" ? note.trim().slice(0, 500) || null : null,
    });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/account/request-deletion:", getErrorMessage(err));
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
