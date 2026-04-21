import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SIGHTENGINE_API_USER = Deno.env.get('SIGHTENGINE_API_USER')
const SIGHTENGINE_API_SECRET = Deno.env.get('SIGHTENGINE_API_SECRET')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

Deno.serve(async (req) => {
  let itemId = null;
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  try {
    const payload = await req.json()
    const { record } = payload 
    itemId = record.id

    // Танҳо эълонҳое, ки дар ҳолати 'pending' ҳастанд, тафтиш мешаванд
    if (record.moderation_status !== 'pending') {
      return new Response("Not pending", { status: 200 })
    }

    // 1. Интизории кӯтоҳ (3 сония), то расмҳо пурра бор шаванд
    await new Promise(resolve => setTimeout(resolve, 3000))

    const { data: images } = await supabase
      .from('item_images')
      .select('image_url')
      .eq('item_id', itemId)

    if (!images || images.length === 0) {
      // Агар расм набошад, эълонро Approved мекунем (чун чизе барои санҷиш нест)
      await supabase.from('items').update({ moderation_status: 'approved' }).eq('id', itemId)
      return new Response("No images, approved", { status: 200 })
    }

    let isSafe = true;
    let rejectionReason = null;
    let apiErrorOccurred = false;

    // 2. Тафтиши ҳар як расм бо қоидаҳои НИҲОЯТ САХТ
    for (const img of images) {
      try {
        const models = "nudity-2.1,wad,offensive,gore,face-attributes,text-content,scam"
        const response = await fetch(
          `https://api.sightengine.com/1.0/check.json?url=${encodeURIComponent(img.image_url)}&models=${models}&api_user=${SIGHTENGINE_API_USER}&api_secret=${SIGHTENGINE_API_SECRET}`
        )
        const data = await response.json()
        
        if (data.status !== 'success') {
          throw new Error(data.error?.message || "API error")
        }

        // --- ФИЛТРҲОИ ЭКСТРЕМАЛӢ (НИҲОЯТ САХТ) ---

        // 1. Бараҳнагӣ ва Эротика (Ҳатто шубҳаи хурд рад мешавад)
        if (data.nudity && (data.nudity.sexual_activity > 0.01 || data.nudity.sexual_display > 0.01 || data.nudity.erotica > 0.05)) {
          isSafe = false; rejectionReason = 'Мундариҷаи номуносиб ё эротикӣ'; break;
        } 
        
        // 2. Силоҳ, Алкогол ва Маводи мухаддир (WAD) - 0.05 ҳадди ниҳоӣ
        else if (data.weapon > 0.05) {
          isSafe = false; rejectionReason = 'Намоиши силоҳ (ҳатто бозича) манъ аст'; break;
        } else if (data.alcohol > 0.05) {
          isSafe = false; rejectionReason = 'Намоиши машрубот манъ аст'; break;
        } else if (data.drugs > 0.05) {
          isSafe = false; rejectionReason = 'Намоиши маводи мухаддир ё доруҳо манъ аст'; break;
        }

        // 3. Таҳқир, Хун ва Хушунат (Gore)
        else if (data.offensive && data.offensive.prob > 0.1) {
          isSafe = false; rejectionReason = 'Рамзҳо ё имову ишораҳои таҳқиромез'; break;
        } else if (data.gore && data.gore.prob > 0.1) {
          isSafe = false; rejectionReason = 'Намоиши хушунат ё саҳнаҳои нохуш'; break;
        }

        // 4. Одам (Face Detection) - АГАР ҲАТТО ЯК ЧЕҲРА БОШАД, РАД МЕКУНЕМ
        else if (data.faces && data.faces.length > 0) {
          isSafe = false; rejectionReason = 'Дар расм одам пайдо шуд. Лутфан танҳо расми маҳсулотро гузоред.'; break;
        }

        // 5. Матни хатарнок (Рақам, Email, Link)
        else if (data.text && (data.text.has_phone || data.text.has_email || data.text.has_link)) {
          isSafe = false; rejectionReason = 'Дар рӯи расм рақами телефон ё линк навишта шудааст.'; break;
        }

        // 6. Қаллобӣ (Scam)
        else if (data.scam && data.scam.prob > 0.3) {
          isSafe = false; rejectionReason = 'Ин расм шубҳанок аст (эҳтимоли қаллобӣ)'; break;
        }

      } catch (e) {
        console.error("Sightengine API Error:", e.message)
        apiErrorOccurred = true;
        break; // Агар API кор накунад, тафтишро қатъ мекунем
      }
    }

    // 3. ҚАРОРИ НИҲОӢ (СТРАТЕГИЯИ БЕХАТАР)
    if (apiErrorOccurred) {
      // АГАР ХАТОИ API ШУД - ЭЪЛОНРО APPROVED НАМЕКУНЕМ!
      // Онро дар ҳолати 'pending' мемонем ва сабабашро менависем
      await supabase.from('items').update({ 
        moderation_status: 'pending', // Ба ҳолати интизорӣ бармегардонем
        moderation_result: 'Хатои техникӣ ҳангоми тафтиш. Мунтазири тафтиши дастӣ.'
      }).eq('id', itemId)
      return new Response("API Error, remains pending", { status: 200 })
    }

    const finalStatus = isSafe ? 'approved' : 'rejected'
    await supabase.from('items').update({ 
      moderation_status: finalStatus,
      moderation_result: rejectionReason 
    }).eq('id', itemId)

    return new Response(JSON.stringify({ success: true, status: finalStatus }), { status: 200 })

  } catch (error: any) {
    // Дар ҳолати хатои критиқии код низ APPROVED намекунем
    if (itemId) {
      await supabase.from('items').update({ 
        moderation_status: 'pending',
        moderation_result: 'System Error: ' + error.message
      }).eq('id', itemId)
    }
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
