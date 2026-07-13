import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { Webhook } from "https://esm.sh/svix@1.21.0"

// Эти переменные автоматически подтягиваются из настроек Supabase (Secrets)
const CLERK_WEBHOOK_SECRET = Deno.env.get('CLERK_WEBHOOK_SECRET')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

Deno.serve(async (req) => {
  // Проверка конфигурации
  if (!CLERK_WEBHOOK_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response("Configuration missing", { status: 500 })
  }

  // 1. Извлекаем Svix заголовки для проверки безопасности
  const svix_id = req.headers.get("svix-id")
  const svix_timestamp = req.headers.get("svix-timestamp")
  const svix_signature = req.headers.get("svix-signature")

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Missing svix headers", { status: 400 })
  }

  // 2. Читаем тело запроса
  const payload = await req.json()
  const body = JSON.stringify(payload)

  // 3. Проверяем подпись (Signature Verification)
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

  // 4. Подключаемся к Supabase с Service Role (чтобы обойти RLS)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { type, data } = evt

  console.log(`Processing Clerk event: ${type}`)

  try {
    // 5. Обработка событий создания и обновления пользователя
    if (type === "user.created" || type === "user.updated") {
      const { id, first_name, last_name, image_url, phone_numbers, email_addresses, primary_email_address_id, primary_phone_number_id } = data

      // Клерк тартиби массивро кафолат намедиҳад — бояд аниқ бо
      // primary_*_id мувофиқат кунем, на танҳо индекси 0-ро гирем
      // (вагарна email метавонад холӣ ё нодуруст сабт шавад).
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

    // 6. Ҳисоби Clerk воқеан нест карда шуд. Барои "Пурра нест кардан"-и
    // admin, тозакунии Supabase аллакай мустақим дар API route рӯй медиҳад
    // (то ба фаъол будани ин webhook дар Clerk Dashboard такя накунад) — ин
    // ҷо танҳо fallback/идемпотент такрор аст (агар profile аллакай нест
    // бошад, ҳеҷ коре намекунад). Барои "худи корбар ҳисобашро нест мекунад"
    // (user.delete() дар Танзимот), ИН ҶО ЯГОНА роҳест, ки rӯй медиҳад — пас
    // "user.deleted" бояд дар Clerk Dashboard → Webhooks фаъол бошад,
    // вагарна ҳисобҳои худ-нестшуда ҳаргиз аз Supabase пок намешаванд.
    // Ҳарду роҳ якхела: snapshot дар deleted_accounts_archive, тоза кардани
    // файлҳои Storage (аксҳои эълонҳо + avatar) ва push_tokens (FK надоранд),
    // баъд DELETE-и худи profile — ки CASCADE FK ҳамаи items/item_images/
    // saved_items/safety_box/item_verification_attempts-ро низ пок мекунад.
    // Admin-и soft-delete ("Нест кардан"-и оддӣ, дар trash) Clerk-ро тамоман
    // ламс намекунад, пас ин ҷо ҳаргиз намерасад — фақат ҳангоми "Пурра нест
    // кардан" ё худи корбар.
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
        const { data: safetyBoxItems } = await supabase
          .from("safety_box")
          .select("id, item_name, description, category, type, reward, images, date, created_at")
          .eq("user_id", id)
        const { data: verificationAttempts } = await supabase
          .from("item_verification_attempts")
          .select("id, item_id, status, created_at, answers, items(title)")
          .eq("claimant_token", id)

        const itemIds = (items ?? []).map((i: any) => i.id)

        await supabase.from("deleted_accounts_archive").insert([{
          user_id: id,
          profile_snapshot: {
            profile,
            items: items ?? [],
            savedItems: savedItems ?? [],
            safetyBoxItems: safetyBoxItems ?? [],
            verificationAttempts: verificationAttempts ?? [],
          },
          items_count: itemIds.length,
        }])

        // Ҳар эълони корбар низ алоҳида дар deleted_items_archive сабт мешавад,
        // то саҳифаи Эълонҳо → "Нестшудаҳо" онҳоро низ бинад.
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

    // 7. Воридшавии нав — барои "Last Login" дар admin panel.
    // ЭЗОҲ: ин рӯйдод бояд дар танзимоти webhook-и Clerk Dashboard фаъол шавад
    // (session.created), вагарна ҳеҷ гоҳ фиристода намешавад.
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
