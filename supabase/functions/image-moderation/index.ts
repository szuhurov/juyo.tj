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
        const response = await fetch(
          `https://api.sightengine.com/1.0/check.json?url=${encodeURIComponent(img.image_url)}&models=nudity-2.0,wad,offensive&api_user=${SIGHTENGINE_API_USER}&api_secret=${SIGHTENGINE_API_SECRET}`
        )
        const data = await response.json()
        
        if (data.status !== 'success') {
          throw new Error(data.error?.message || "API limit or error")
        }

        if (data.nudity && (data.nudity.sexual_activity > 0.1 || data.nudity.sexual_display > 0.1)) {
          isSafe = false; rejectionReason = 'Inappropriate content (nudity)'; break;
        } else if (data.weapon > 0.2) {
          isSafe = false; rejectionReason = 'Inappropriate content (weapons)'; break;
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
