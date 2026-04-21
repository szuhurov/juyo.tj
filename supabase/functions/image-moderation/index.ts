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

    await new Promise(resolve => setTimeout(resolve, 3000))

    const { data: images } = await supabase
      .from('item_images')
      .select('image_url')
      .eq('item_id', itemId)

    if (!images || images.length === 0) {
      await supabase.from('items').update({ moderation_status: 'approved' }).eq('id', itemId)
      return new Response("No images, approved", { status: 200 })
    }

    let isSafe = true;
    let rejectionKey = null;
    let apiErrorOccurred = false;

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

        // 1. Nudity
        if (data.nudity && (data.nudity.sexual_activity > 0.2 || data.nudity.sexual_display > 0.2 || data.nudity.erotica > 0.3)) {
          isSafe = false; rejectionKey = 'mod_nudity'; break;
        } 
        
        // 2. WAD
        const wad = data.wad;
        if (wad) {
          if (wad.weapons > 0.1) { isSafe = false; rejectionKey = 'mod_weapon'; break; }
          if (wad.alcohol > 0.2) { isSafe = false; rejectionKey = 'mod_alcohol'; break; }
          if (wad.drugs > 0.1) { isSafe = false; rejectionKey = 'mod_drugs'; break; }
        }

        // 3. Offensive & Gore
        if (data.offensive && data.offensive.prob > 0.3) {
          isSafe = false; rejectionKey = 'mod_offensive'; break;
        }
        if (data.gore && data.gore.prob > 0.3) {
          isSafe = false; rejectionKey = 'mod_gore'; break;
        }

        // 4. Faces (Including faces on documents)
        if (data.faces && data.faces.length > 0) {
          isSafe = false; rejectionKey = 'mod_faces'; break;
        }

        // 5. Text (Phones/Emails)
        const text = data.text;
        if (text && (text.personal?.length > 0 || text.link?.length > 0)) {
          const hasContact = text.personal.some((p: any) => p.type === 'phone' || p.type === 'email');
          if (hasContact) {
            isSafe = false; rejectionKey = 'mod_text'; break;
          }
        }

        // 6. Scam
        if (data.scam && data.scam.prob > 0.5) {
          isSafe = false; rejectionKey = 'mod_scam'; break;
        }

      } catch (e) {
        console.error("Sightengine API Error:", e.message)
        apiErrorOccurred = true;
        break;
      }
    }

    if (apiErrorOccurred) {
      await supabase.from('items').update({ 
        moderation_status: 'pending',
        moderation_result: 'mod_error_api'
      }).eq('id', itemId)
      return new Response("API Error", { status: 200 })
    }

    const finalStatus = isSafe ? 'approved' : 'rejected'
    await supabase.from('items').update({ 
      moderation_status: finalStatus,
      moderation_result: rejectionKey 
    }).eq('id', itemId)

    return new Response(JSON.stringify({ success: true, status: finalStatus }), { status: 200 })

  } catch (error: any) {
    if (itemId) {
      await supabase.from('items').update({ 
        moderation_status: 'pending',
        moderation_result: 'mod_error_system'
      }).eq('id', itemId)
    }
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
