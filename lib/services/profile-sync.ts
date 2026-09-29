import { clerkClient } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type SyncedField = "email" | "first_name" | "last_name" | "avatar_url" | "phone";

/**
 * Makes sure the profile row has the email/name/avatar/phone Clerk knows —
 * whatever path created it (web, app, email or Google). Fills ONLY empty
 * fields, never overwrites what the user or the app already saved. The Clerk
 * webhook (clerk-sync) normally does this; this is the guarantee when it is
 * late, disabled or failed. Server-only (secret key + service role).
 */
export async function syncProfileFromClerk(userId: string): Promise<{ created: boolean; filled: SyncedField[] }> {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);

  const fromClerk: Record<SyncedField, string | null> = {
    email:
      user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ||
      user.emailAddresses[0]?.emailAddress ||
      null,
    first_name: user.firstName || null,
    last_name: user.lastName || null,
    avatar_url: user.imageUrl || null,
    phone:
      user.phoneNumbers.find((p) => p.id === user.primaryPhoneNumberId)?.phoneNumber ||
      user.phoneNumbers[0]?.phoneNumber ||
      null,
  };

  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("id, email, first_name, last_name, avatar_url, phone")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;

  const now = new Date().toISOString();

  if (!profile) {
    const row = Object.fromEntries(Object.entries(fromClerk).filter(([, v]) => v)) as Partial<Record<SyncedField, string>>;
    const { error: insertError } = await supabaseAdmin.from("profiles").upsert({ id: userId, ...row, updated_at: now });
    if (insertError) throw insertError;
    return { created: true, filled: Object.keys(row) as SyncedField[] };
  }

  const patch: Partial<Record<SyncedField, string>> = {};
  for (const key of Object.keys(fromClerk) as SyncedField[]) {
    const current = (profile as Record<string, unknown>)[key];
    const value = fromClerk[key];
    if (value && (typeof current !== "string" || current.trim() === "")) patch[key] = value;
  }
  if (Object.keys(patch).length > 0) {
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ ...patch, updated_at: now })
      .eq("id", userId);
    if (updateError) throw updateError;
  }
  return { created: false, filled: Object.keys(patch) as SyncedField[] };
}
