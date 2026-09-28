import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { deleteUserAccount } from "@/lib/services/account-deletion";
import { getErrorMessage } from "@/lib/error-utils";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId: adminId } = await auth();
  if (!isAdminUser(adminId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { id } = await params;
    const { status } = await req.json();
    if (!["processed", "rejected"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const { data: request, error: fetchError } = await supabaseAdmin
      .from("account_deletion_requests")
      .select("email")
      .eq("id", id)
      .single();
    if (fetchError) throw fetchError;

    // "Processed" = admin has verified identity — find the actual Clerk
    // account with this same email and delete it completely (just like the
    // user themselves would via /api/account/delete). If no account with
    // this email exists, mark the request as "processed" anyway (there's
    // nothing to delete).
    if (status === "processed") {
      const client = await clerkClient();
      const { data: users } = await client.users.getUserList({ emailAddress: [request.email] });
      if (users.length > 0) {
        await deleteUserAccount(users[0].id);
      }
    }

    const { error } = await supabaseAdmin
      .from("account_deletion_requests")
      .update({ status, processed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/admin/deletion-requests/[id]:", getErrorMessage(err));
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
