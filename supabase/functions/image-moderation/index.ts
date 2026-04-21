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

    if (record.moderation_status !== 'pending') {
      return new Response("Not pending", { status: 200 })
    }

    // 1. Интизории кӯтоҳ барои расмҳо
    await new Promise(resolve => setTimeout(resolve, 3000))

    const { data: images } = await supabase
      .from('item_images')
      .select('image_url')
      .eq('item_id', itemId)

    if (!images || images.length === 0) {
      // Агар расм набошад, эълонро автоматӣ тасдиқ мекунем
      await supabase.from('items').update({ moderation_status: 'approved' }).eq('id', itemId)
      return new Response("No images, approved", { status: 200 })
    }

    let isSafe = true;
    let rejectionReason = null;

    // 2. Кӯшиши тафтиш тавассути Sightengine
    for (const img of images) {
      try {
        // Илова кардани моделҳои нав: face-attributes, text-content, scam, gore
        const models = "nudity-2.1,wad,offensive,gore,face-attributes,text-content,scam"
        const response = await fetch(
          `https://api.sightengine.com/1.0/check.json?url=${encodeURIComponent(img.image_url)}&models=${models}&api_user=${SIGHTENGINE_API_USER}&api_secret=${SIGHTENGINE_API_SECRET}`
        )
        const data = await response.json()
        
        if (data.status !== 'success') {
          throw new Error(data.error?.message || "API limit or error")
        }

        // --- САНҶИШҲОИ САХТГИРОНА ---

        // 1. Бараҳнагӣ (Nudity) - Лимити сахттар (0.05)
        if (data.nudity && (data.nudity.sexual_activity > 0.05 || data.nudity.sexual_display > 0.05 || data.nudity.erotica > 0.1)) {
          isSafe = false; rejectionReason = 'Мундариҷаи номуносиб (бараҳнагӣ ё эротика)'; break;
        } 
        
        // 2. Силоҳ, Алкогол ва Маводи мухаддир (WAD)
        else if (data.weapon > 0.1) {
          isSafe = false; rejectionReason = 'Намоиши силоҳ манъ аст'; break;
        } else if (data.alcohol > 0.1) {
          isSafe = false; rejectionReason = 'Намоиши машрубот (алкогол) манъ аст'; break;
        } else if (data.drugs > 0.1) {
          isSafe = false; rejectionReason = 'Намоиши маводи мухаддир ё маводи шубҳанок манъ аст'; break;
        }

        // 3. Мундариҷаи таҳқиромез ва хушунат (Offensive & Gore)
        else if (data.offensive && data.offensive.prob > 0.2) {
          isSafe = false; rejectionReason = 'Рамзҳо ё имову ишораҳои таҳқиромез пайдо шуд'; break;
        } else if (data.gore && data.gore.prob > 0.2) {
          isSafe = false; rejectionReason = 'Намоиши хушунат ва саҳнаҳои даҳшатнок манъ аст'; break;
        }

        // 4. Мавҷудияти одамон (Faces)
        else if (data.faces && data.faces.length > 0) {
          isSafe = false; rejectionReason = 'Дар расм чеҳраи одам пайдо шуд. Лутфан танҳо расми маҳсулотро гузоред.'; break;
        }

        // 5. Матни рӯи расм (Рақами телефон, Email, Линк)
        else if (data.text && (data.text.has_phone || data.text.has_email || data.text.has_link)) {
          let type = data.text.has_phone ? 'рақами телефон' : (data.text.has_email ? 'email' : 'линк');
          isSafe = false; rejectionReason = `Дар рӯи расм ${type} навишта шудааст. Ин хатарнок аст.`; break;
        }

        // 6. Қаллобӣ (Known Scams)
        else if (data.scam && data.scam.prob > 0.5) {
          isSafe = false; rejectionReason = 'Ин расм ҳамчун расми шубҳанок ё қаллобӣ муайян карда шуд'; break;
        }

      } catch (e) {
        // АГАР ХАТО ШУД (ЛИМИТ ТАМОМ ШУД) - МО ИДОМА МЕДИҲЕМ (BYPASS)
        console.error("Sightengine Error, auto-approving...", e.message)
        isSafe = true; // Автоматӣ иҷозат медиҳем
        break;
      }
    }

    // 3. Навсозии база (Ҳатман иҷро мешавад)
    const finalStatus = isSafe ? 'approved' : 'rejected'
    await supabase.from('items').update({ 
      moderation_status: finalStatus,
      moderation_result: rejectionReason 
    }).eq('id', itemId)

    return new Response(JSON.stringify({ success: true, status: finalStatus }), { status: 200 })

  } catch (error: any) {
    // ДАР ҲОЛАТИ ХАТОИ КРИТИКӢ НИЗ ЭЪЛОНРО APPROVED МЕКУНЕМ
    if (itemId) {
      await supabase.from('items').update({ 
        moderation_status: 'approved',
        moderation_result: 'Auto-approved due to system error'
      }).eq('id', itemId)
    }
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
