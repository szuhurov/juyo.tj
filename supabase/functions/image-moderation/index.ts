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

    if (record.moderation_status !== 'pending') return new Response("OK", { status: 200 })

    // Гирифтани аксҳо барои таҳлил
    const { data: images } = await supabase.from('item_images').select('image_url').eq('item_id', itemId)
    const textToCheck = `${record.title} ${record.description || ''}`;

    let isSafe = true;
    let rejectionReason = null;

    // 1. Ҳамаи аксҳоро барои таҳлил омода мекунем
    if (images && images.length > 0) {
      const imageContent = images.map(img => ({
        type: "image_url",
        image_url: { url: img.image_url }
      }));

      const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-5.5",
          messages: [
            {
              role: "system",
              content: "You are a professional content moderator for a 'Lost and Found' app in Tajikistan. Analyze ALL provided images and text. STRICTLY BLOCK: nudity, violence, weapons, drugs, adult items (sex toys, dildos, etc.). Prohibit adult items even if they are made of plastic or appear as toys. Also check if the content is relevant to 'lost and found' items. Return JSON: { 'is_safe': boolean, 'reason': string or null }"
            },
            {
              role: "user",
              content: [
                { type: "text", text: `Title/Description: ${textToCheck}` },
                ...imageContent
              ]
            }
          ],
          response_format: { type: "json_object" }
        }),
      });

      const aiData = await aiResponse.json();
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
