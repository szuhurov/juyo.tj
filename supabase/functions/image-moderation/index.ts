import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

Deno.serve(async (req) => {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
  
  try {
    const payload = await req.json()
    const { record } = payload 
    const itemId = record.id

    // Skip if already moderated (e.g. by AI Brain in the UI)
    if (record.moderation_status !== 'pending') {
      return new Response("Already moderated, skipping", { status: 200 });
    }

    // Гирифтани аксҳо барои таҳлил
    const { data: images } = await supabase.from('item_images').select('image_url').eq('item_id', itemId)
    const textToCheck = `${record.title} ${record.description || ''}`;

    let isSafe = true;
    let rejectionReason = null;

    // 1. Ҳамаи аксҳоро барои таҳлил омода мекунем
    if (images && images.length > 0) {
      const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-5.5",
          reasoning_effort: "medium",
          messages: [
            {
              role: "system",
              content: `You are a common-sense content moderator for JUYO.tj (Lost & Found app). 
STRICT RULES:
1. ALLOWED (is_safe: true):
   - ANIMALS: Pets (dogs, cats, etc.) are 100% ALLOWED.
   - ELECTRONICS: Phones, laptops, items in hands are 100% ALLOWED.
   - DOCUMENTS: Passports/IDs are 100% ALLOWED even with faces.
   - GENERAL: Keys, bags, clothes, etc.
2. PROHIBITED (is_safe: false):
   - 18+ Content (Nudity/Sexual).
   - Violence (Blood/Gore/Corpses).
   - Weapons (Guns/Knives).
   - Drugs.
   - Solo portraits/selfies with no object.
Return JSON ONLY: { "is_safe": boolean, "reason": "Short reason in Tajik or null" }`
            },
            {
              role: "user",
              content: [
                { type: "text", text: `Title/Description: ${textToCheck}` },
                ...images.map(img => ({
                  type: "image_url",
                  image_url: { url: img.image_url, detail: "auto" }
                }))
              ]
            }
          ],
          response_format: { type: "json_object" }
        }),
      });

      const aiData = await aiResponse.json();
      if (aiData.error) throw new Error(aiData.error.message);
      const result = JSON.parse(aiData.choices[0].message.content);
      
      isSafe = result.is_safe;
      rejectionReason = result.reason;
    } else {
      // Тафтиши танҳо матн агар расм набошад
      const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-5.5",
          reasoning_effort: "low",
          messages: [
            {
              role: "system",
              content: "Analyze this text for profanity or illegal content in Tajikistan. Return JSON: { 'is_safe': boolean, 'reason': string or null }"
            },
            { role: "user", content: textToCheck }
          ],
          response_format: { type: "json_object" }
        }),
      });

      const aiData = await aiResponse.json();
      if (aiData.error) throw new Error(aiData.error.message);
      const result = JSON.parse(aiData.choices[0].message.content);
      isSafe = result.is_safe;
      rejectionReason = result.reason;
    }

    const finalStatus = isSafe ? 'approved' : 'rejected'
    
    await supabase.from('items').update({ 
      moderation_status: finalStatus, 
      moderation_result: rejectionReason, 
      updated_at: new Date().toISOString() 
    }).eq('id', itemId)

    return new Response(JSON.stringify({ success: true, status: finalStatus }), { status: 200 })

  } catch (error: any) {
    console.error("OpenAI Moderation Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
