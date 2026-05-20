import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SIGHTENGINE_API_USER = Deno.env.get('SIGHTENGINE_API_USER')
const SIGHTENGINE_API_SECRET = Deno.env.get('SIGHTENGINE_API_SECRET')
const SIGHTENGINE_LIST_ID = Deno.env.get('SIGHTENGINE_LIST_ID')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

Deno.serve(async (req) => {
  let itemId = null;
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  try {
    const payload = await req.json()
    const { record } = payload 
    itemId = record.id

    if (record.moderation_status !== 'pending') return new Response("OK", { status: 200 })

    await new Promise(resolve => setTimeout(resolve, 3000))

    const { data: images } = await supabase.from('item_images').select('id, image_url').eq('item_id', itemId)
    if (!images || images.length === 0) {
      await supabase.from('items').update({ moderation_status: 'approved' }).eq('id', itemId)
      return new Response("No images", { status: 200 })
    }

    let isSafe = true;
    let rejectionKey = null;

    for (const img of images) {
      try {
        const models = "nudity-2.1,wad,gore,face-attributes,scam"
        const seRes = await fetch(`https://api.sightengine.com/1.0/check.json?url=${encodeURIComponent(img.image_url)}&models=${models}&api_user=${SIGHTENGINE_API_USER}&api_secret=${SIGHTENGINE_API_SECRET}`);
        const seData = await seRes.json();
        
        if (seData.status === 'success') {
          const n = seData.nudity;
          if (n && (n.none < 0.99 || n.sexual_activity > 0.01 || n.erotica > 0.01)) { isSafe = false; rejectionKey = 'mod_nudity'; break; }
          if (seData.wad && (seData.wad.drugs > 0.001 || seData.wad.weapons > 0.01)) { isSafe = false; rejectionKey = 'mod_drugs'; break; }
          if (seData.faces && seData.faces.some((f: any) => (f.x2-f.x1)*(f.y2-f.y1) > 0.06)) { isSafe = false; rejectionKey = 'mod_faces'; break; }
        }
      } catch (e) { console.error("API Error:", e); }
      if (!isSafe) break;
    }

    const finalStatus = isSafe ? 'approved' : 'rejected'
    
    if (finalStatus === 'approved' && SIGHTENGINE_LIST_ID) {
      for (const img of images) {
        // ТАНҲО ID-И АКСРО МЕФИРИСТЕМ
        await fetch("https://api.sightengine.com/1.0/check.json", {
          method: 'POST',
          body: new URLSearchParams({ 
            'api_user': SIGHTENGINE_API_USER!, 
            'api_secret': SIGHTENGINE_API_SECRET!, 
            'url': img.image_url, 
            'add_to_list': SIGHTENGINE_LIST_ID, 
            'custom_id': img.id 
          })
        });
      }
    }

    await supabase.from('items').update({ moderation_status: finalStatus, moderation_result: rejectionKey, updated_at: new Date().toISOString() }).eq('id', itemId)
    return new Response(JSON.stringify({ success: true, status: finalStatus }), { status: 200 })

  } catch (error: any) {
    if (itemId) await supabase.from('items').update({ moderation_status: 'pending' }).eq('id', itemId)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
