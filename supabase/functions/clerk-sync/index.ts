import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { Webhook } from "https://esm.sh/svix@1.21.0"

// These variables are automatically pulled from Supabase's settings (Secrets)
const CLERK_WEBHOOK_SECRET = Deno.env.get('CLERK_WEBHOOK_SECRET')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

Deno.serve(async (req) => {
  // Configuration check
  if (!CLERK_WEBHOOK_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response("Configuration missing", { status: 500 })
  }

  // 1. Extract the Svix headers for security verification
  const svix_id = req.headers.get("svix-id")
  const svix_timestamp = req.headers.get("svix-timestamp")
  const svix_signature = req.headers.get("svix-signature")

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Missing svix headers", { status: 400 })
  }

  // 2. Read the request body
  const payload = await req.json()
  const body = JSON.stringify(payload)

  // 3. Verify the signature (Signature Verification)
  const wh = new Webhook(CLERK_WEBHOOK_SECRET)
  let evt: any

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    })
  } catch (err) {
    console.error("Webhook verification failed:", err)
    return new Response("Invalid signature", { status: 400 })
  }

  // 4. Connect to Supabase with the Service Role (to bypass RLS)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { type, data } = evt

  console.log(`Processing Clerk event: ${type}`)

  try {
    // 5. Handle user creation and update events
    if (type === "user.created" || type === "user.updated") {
      const { id, first_name, last_name, image_url, phone_numbers, email_addresses, primary_email_address_id, primary_phone_number_id } = data

      // Clerk doesn't guarantee array order — we must match precisely by
      // primary_*_id instead of just taking index 0
      // (otherwise the email could be saved empty or wrong).
      const primaryPhone = phone_numbers?.find((p: any) => p.id === primary_phone_number_id)
      const phone = primaryPhone?.phone_number || phone_numbers?.[0]?.phone_number || null

      const primaryEmail = email_addresses?.find((e: any) => e.id === primary_email_address_id)
      const email = primaryEmail?.email_address || email_addresses?.[0]?.email_address || null

      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: id,
          first_name: first_name || "",
          last_name: last_name || "",
          avatar_url: image_url || "",
          phone: phone,
          email: email,
          updated_at: new Date().toISOString(),
        })

      if (error) throw error
    }

    // 6. The Clerk account was actually deleted. For the admin's "Delete
    // Permanently", the Supabase cleanup already happens directly in the API
    // route (so it doesn't depend on this webhook being enabled in the Clerk
    // Dashboard) — this here is just a fallback/idempotent repeat (if the
    // profile is already gone, it does nothing). For "the user deletes their
    // own account" (user.delete() in Settings), THIS IS THE ONLY path that
    // runs it — so "user.deleted" must be enabled in Clerk Dashboard →
    // Webhooks, otherwise self-deleted accounts never get cleaned up from
    // Supabase. Both paths do the same thing: snapshot into
    // deleted_accounts_archive, clean up Storage files (listing photos +
    // avatar) and push_tokens (they have no FK), then DELETE the profile
    // itself — whose CASCADE FK also cleans up all items/item_images/
    // saved_items.
    // The admin's soft-delete ("Delete" in the regular sense, into the
    // trash) never touches Clerk at all, so it never reaches this code —
    // only "Delete Permanently" or the user themselves trigger it.
    if (type === "user.deleted") {
      const { id } = data

      const { data: profile } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle()

      if (profile) {
        const ITEM_FIELDS = "id, title, category, type, is_resolved, moderation_status, created_at, images:item_images(image_url)"

        const { data: items } = await supabase.from("items").select(ITEM_FIELDS).eq("user_id", id)
        const { data: savedItems } = await supabase
          .from("saved_items")
          .select(`item_id, created_at, items(${ITEM_FIELDS})`)
          .eq("user_id", id)

        const itemIds = (items ?? []).map((i: any) => i.id)

        await supabase.from("deleted_accounts_archive").insert([{
          user_id: id,
          profile_snapshot: {
            profile,
            items: items ?? [],
            savedItems: savedItems ?? [],
          },
          items_count: itemIds.length,
        }])

        // Each of the user's listings is also separately recorded in
        // deleted_items_archive, so the Listings → "Deleted" page can see them too.
        if ((items ?? []).length > 0) {
          await supabase.from("deleted_items_archive").insert(
            (items ?? []).map((item: any) => ({
              item_id: item.id,
              item_snapshot: { ...item, profiles: { first_name: profile.first_name, last_name: profile.last_name } },
            })),
          )
        }

        const storagePaths: string[] = []
        const extractStoragePath = (imageUrl: string | null) => {
          if (!imageUrl) return null
          try {
            const parts = new URL(imageUrl).pathname.split("/public/items/")
            return parts.length > 1 ? parts[1] : null
          } catch {
            const parts = imageUrl.split("/public/items/")
            return parts.length > 1 ? parts[1].split("?")[0] : null
          }
        }

        for (const item of items ?? []) {
          for (const img of (item as any).images ?? []) {
            const path = extractStoragePath(img.image_url)
            if (path) storagePaths.push(path)
          }
        }
        const avatarPath = extractStoragePath(profile.avatar_url)
        if (avatarPath) storagePaths.push(avatarPath)

        if (storagePaths.length > 0) {
          await supabase.storage.from("items").remove(storagePaths)
        }

        await supabase.from("push_tokens").delete().eq("user_id", id)

        const { error: deleteError } = await supabase.from("profiles").delete().eq("id", id)
        if (deleteError) throw deleteError
      }
    }

    // 7. New sign-in — for "Last Login" in the admin panel.
    // NOTE: this event must be enabled in the Clerk Dashboard webhook settings
    // (session.created), otherwise it will never be sent.
    if (type === "session.created") {
      const userId = data.user_id
      if (userId) {
        await supabase
          .from("profiles")
          .update({ last_login_at: new Date().toISOString() })
          .eq("id", userId)
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })

  } catch (dbError: any) {
    console.error("Database sync error:", dbError.message)
    return new Response(JSON.stringify({ error: dbError.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    })
  }
})
