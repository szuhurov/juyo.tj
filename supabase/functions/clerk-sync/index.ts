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
      const { id, first_name, last_name, image_url, phone_numbers } = data
      
      // Берем первый номер телефона из массива Clerk
      const phone = phone_numbers?.[0]?.phone_number || null

      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: id,
          first_name: first_name || "",
          last_name: last_name || "",
          avatar_url: image_url || "",
          phone: phone,
          updated_at: new Date().toISOString(),
        })

      if (error) throw error
    }

    // 6. Обработка удаления пользователя
    if (type === "user.deleted") {
      const { id } = data
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", id)
      
      if (error) throw error
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
