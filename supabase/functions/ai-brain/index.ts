import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// MASTER FORENSIC PROMPT (Identical across all functions)
const MASTER_FORENSIC_PROMPT = `You are an elite forensic AI expert specialized in object identification. 
Analyze the image with extreme precision to find unique identifiers.
Identify: Brand, Model, Precise Color shades, Material, and UNIQUE SIGNS (scratches, dents, stickers, wear).
Return JSON: { 
  'description_en': 'EXHAUSTIVE forensic technical string in English for 100% vector matching' 
}`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const formData = await req.formData();
    const image = formData.get('image') as File;
    const type = formData.get('type') || 'lost';
    const title = formData.get('title') || '';
    const description = formData.get('description') || '';
    const lang = formData.get('lang') || 'tg';
    const mode = formData.get('mode') || 'full'; // 'full', 'moderation', 'similarity'

    // Map language codes to names for AI
    const langNames: Record<string, string> = { tg: 'Tajik', ru: 'Russian', en: 'English' };
    const targetLang = langNames[lang as string] || 'Tajik';

    if (!image) throw new Error("No image provided");

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // CONVERT IMAGE TO BASE64
    const arrayBuffer = await image.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = "";
    const len = uint8Array.byteLength;
    for (let i = 0; i < len; i++) { binary += String.fromCharCode(uint8Array[i]); }
    const base64Image = btoa(binary);

    // 1. MODERATION (Fast Check - GPT-4o-MINI) - Skip if mode is 'similarity'
    let isSafe = true;
    let dynamicReason = null;

    if (mode === 'full' || mode === 'moderation') {
      try {
        const moderationResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gpt-4o-mini", // Use gpt-4o-mini for better reliability
            messages: [
              { 
                role: "system", 
                content: `You are a helpful content moderator for JUYO (Tajikistan). 
                Block ONLY dangerous content: nudity, violence, drugs, weapons, profanity. 
                ALLOW documents and passports (even with faces). 
                Return JSON: { 'is_safe': boolean, 'reason': string or null in ${targetLang} }` 
              },
              { role: "user", content: [{ type: "text", text: `Title: ${title}\nDesc: ${description}` }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }] }
            ],
            response_format: { type: "json_object" }
          }),
        });
        
        const modData = await moderationResponse.json();
        const modResult = JSON.parse(modData.choices[0].message.content);
        isSafe = modResult.is_safe;
        dynamicReason = modResult.reason;
      } catch (e) {
        console.error("Moderation error:", e.message);
        isSafe = true; 
      }

      if (!isSafe) {
        return new Response(JSON.stringify({ is_safe: false, reason: dynamicReason }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // If only moderation was requested, return early
      if (mode === 'moderation') {
        return new Response(JSON.stringify({ is_safe: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // 2. DETAILED FORENSIC ANALYSIS (GPT-4o - Flagship)
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o", // Changed from gpt-5.5 (non-existent) to gpt-4o
        messages: [
          { role: "system", content: MASTER_FORENSIC_PROMPT },
          { role: "user", content: [{ type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}`, detail: "high" } }] }
        ],
        response_format: { type: "json_object" }
      }),
    });

    const aiData = await aiResponse.json();
    const forensicResult = JSON.parse(aiData.choices[0].message.content);

    // 3. GENERATE EMBEDDING
    const embRes = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "text-embedding-3-small", input: forensicResult.description_en }),
    });
    const embData = await embRes.json();
    const embedding = embData.data[0].embedding;

    // 4. VECTOR SEARCH
    const searchType = type === 'found' ? 'lost' : 'found';
    const { data: similarItems } = await supabase.rpc('match_item_images', {
      query_embedding: embedding, match_threshold: 0.05, match_count: 10, p_type: searchType
    });

    return new Response(JSON.stringify({
      is_safe: true,
      analysis: { description_en: forensicResult.description_en, description_tj: "Таҳлили муфассал иҷро шуд" },
      embedding: embedding,
      similarItems: (similarItems || []).map((i: any) => ({ ...i, match_percentage: Math.round(i.similarity * 100) })),
      message: similarItems?.length ? "Found matches" : "No matches"
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error("Global Error:", error.message);
    return new Response(JSON.stringify({ error: error.message, is_safe: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
