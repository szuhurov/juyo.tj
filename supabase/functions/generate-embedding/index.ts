import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts"

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FORENSIC_PROMPT = `You are an elite forensic AI expert specialized in object identification.
Analyze the image with extreme precision to find unique identifiers.
Identify: Brand, Model, Precise Color shades, Material, and UNIQUE SIGNS (scratches, dents, stickers, wear).
Return JSON: {
  "description_en": "EXHAUSTIVE forensic technical string in English for 100% vector matching"
}`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { item_id, text, image_url } = await req.json();

    if (!item_id) throw new Error("Missing item_id");

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    let embeddingText = text;

    // Агар image_url дода шуда бошад, forensic тавсиф аз сурат тавлид мекунем
    if (image_url && !text) {
      const imgRes = await fetch(image_url);
      const arrayBuffer = await imgRes.arrayBuffer();
      const base64Image = encodeBase64(arrayBuffer);

      const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: FORENSIC_PROMPT },
            { role: "user", content: [{ type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}`, detail: "low" } }] }
          ],
          response_format: { type: "json_object" }
        }),
      });

      const aiData = await aiRes.json();
      if (aiData.error) throw new Error(aiData.error.message);
      const forensicResult = JSON.parse(aiData.choices[0].message.content);
      embeddingText = forensicResult.description_en;
    }

    if (!embeddingText) throw new Error("Missing text or image_url");

    // Embedding аз OpenAI
    const embRes = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "text-embedding-3-small", input: embeddingText }),
    });

    const embData = await embRes.json();
    if (embData.error) throw new Error(embData.error.message);
    const embedding = embData.data[0].embedding;

    const { data: firstImage, error: fetchError } = await supabase
      .from('item_images')
      .select('id')
      .eq('item_id', item_id)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (fetchError || !firstImage) {
      return new Response(JSON.stringify({ success: false, message: "No image found" }), { status: 404 });
    }

    const { error: updateError } = await supabase
      .from('item_images')
      .update({ embedding })
      .eq('id', firstImage.id);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error("Embedding Function Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
