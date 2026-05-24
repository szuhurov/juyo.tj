import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// MASTER FORENSIC PROMPT (Identical to AI-Brain for 100% Match)
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
    
    if (!image) throw new Error("No image provided");

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // CONVERT IMAGE TO BASE64
    const arrayBuffer = await image.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = "";
    const len = uint8Array.byteLength;
    for (let i = 0; i < len; i++) { binary += String.fromCharCode(uint8Array[i]); }
    const base64Image = btoa(binary);

    // 1. DETAILED FORENSIC ANALYSIS (GPT-5.5 - IDENTICAL PROMPT)
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-5.5",
        reasoning_effort: "medium",
        messages: [
          { role: "system", content: MASTER_FORENSIC_PROMPT },
          { role: "user", content: [{ type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}`, detail: "high" } }] }
        ],
        response_format: { type: "json_object" }
      }),
    });

    const aiData = await aiResponse.json();
    const forensicResult = JSON.parse(aiData.choices[0].message.content);

    // 2. GENERATE EMBEDDING
    const embRes = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: forensicResult.description_en,
      }),
    });

    const embData = await embRes.json();
    const embedding = embData.data[0].embedding;

    // 3. GLOBAL VECTOR SEARCH (SECURITY DEFINER bypasses RLS)
    const { data: similarItems, error: searchError } = await supabase.rpc('match_item_images', {
      query_embedding: embedding,
      match_threshold: 0.40, // Increased to 0.40 for strict, high-quality matches
      match_count: 20,
      p_type: 'all'
    });

    if (searchError) throw searchError;

    const results = (similarItems || []).map((item: any) => ({
      id: item.item_id,
      score: Math.round(item.similarity * 100),
      title: item.title,
      image_url: item.image_url
    }));

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error("Visual Search Error:", error.message);
    return new Response(JSON.stringify({ error: error.message, results: [] }), { 
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
