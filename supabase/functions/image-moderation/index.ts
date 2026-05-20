import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SIGHTENGINE_API_USER = Deno.env.get('SIGHTENGINE_API_USER')
const SIGHTENGINE_API_SECRET = Deno.env.get('SIGHTENGINE_API_SECRET')
const SIGHTENGINE_LIST_ID = Deno.env.get('SIGHTENGINE_LIST_ID')
const GOOGLE_VISION_API_KEY = Deno.env.get('GOOGLE_VISION_API_KEY')
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
    let aiLabels: string[] = [];

    // 1. Силсилаи санҷишҳои Sightengine ва Google Vision
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      try {
        // --- SIGHTENGINE (Security) ---
        const models = "nudity-2.1,wad,gore,face-attributes,text-content,scam,tobacco"
        const seResponse = await fetch(
          `https://api.sightengine.com/1.0/check.json?url=${encodeURIComponent(img.image_url)}&models=${models}&api_user=${SIGHTENGINE_API_USER}&api_secret=${SIGHTENGINE_API_SECRET}`
        )
        const seData = await seResponse.json()
        
        if (seData.status === 'success') {
          // Санҷиши амният (Nudity, WAD, Gore ва ғайра)
          if (seData.nudity && (seData.nudity.sexual_activity >= 0.95 || seData.nudity.erotica >= 0.95)) { isSafe = false; rejectionKey = 'mod_nudity'; break; }
          if (seData.wad && seData.wad.weapons >= 0.5) { isSafe = false; rejectionKey = 'mod_weapon'; break; }
          if (seData.scam && seData.scam.prob > 0.5) { isSafe = false; rejectionKey = 'mod_scam'; break; }
          if (seData.faces && seData.faces.some((f: any) => (f.x2-f.x1)*(f.y2-f.y1) > 0.06)) { isSafe = false; rejectionKey = 'mod_faces'; break; }
        }

        // --- GOOGLE VISION (Object Recognition - Танҳо барои сурати аввал) ---
        if (i === 0 && GOOGLE_VISION_API_KEY && isSafe) {
          console.log("Extracting AI labels via Google Vision...");
          const visionResponse = await fetch(
            `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
            {
              method: 'POST',
              body: JSON.stringify({
                requests: [{
                  image: { source: { imageUri: img.image_url } },
                  features: [{ type: 'WEB_DETECTION', maxResults: 8 }, { type: 'LABEL_DETECTION', maxResults: 8 }]
                }]
              })
            }
          );
          const visionData = await visionResponse.json();
          const response = visionData.responses[0];
          
          const labels = [
            ...(response.webDetection?.bestGuessLabels || []).map((l: any) => l.label),
            ...(response.webDetection?.webEntities || []).map((e: any) => e.description),
            ...(response.labelAnnotations || []).map((l: any) => l.description)
          ].filter(Boolean);
          
          aiLabels = [...new Set(labels)].slice(0, 15);
          console.log("AI Labels found:", aiLabels.join(", "));
        }

      } catch (e) {
        console.error("API Error:", e.message)
        apiErrorOccurred = true;
        break;
      }
    }

    if (apiErrorOccurred) {
      await supabase.from('items').update({ moderation_status: 'pending', moderation_result: 'mod_error_api' }).eq('id', itemId)
      return new Response("API Error", { status: 200 })
    }

    const finalStatus = isSafe ? 'approved' : 'rejected'
    
    if (finalStatus === 'approved') {
      // 2. Захираи AI Labels дар база
      if (aiLabels.length > 0) {
        await supabase.from('items').update({ ai_labels: aiLabels.join(', ') }).eq('id', itemId);
      }

      // 3. Илова ба Sightengine List (барои ҷустуҷӯи визуалӣ)
      if (SIGHTENGINE_LIST_ID) {
        for (const img of images) {
          try {
            await fetch("https://api.sightengine.com/1.0/check.json", {
              method: 'POST',
              body: new URLSearchParams({
                'api_user': SIGHTENGINE_API_USER!,
                'api_secret': SIGHTENGINE_API_SECRET!,
                'url': img.image_url,
                'add_to_list': SIGHTENGINE_LIST_ID,
                'custom_id': itemId
              })
            });
          } catch (e) { console.error("List Add Error:", e.message); }
        }
      }
    }

    await supabase.from('items').update({ 
      moderation_status: finalStatus,
      moderation_result: rejectionKey 
    }).eq('id', itemId)

    return new Response(JSON.stringify({ success: true, status: finalStatus }), { status: 200 })

  } catch (error: any) {
    if (itemId) await supabase.from('items').update({ moderation_status: 'pending', moderation_result: 'mod_error_system' }).eq('id', itemId)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
