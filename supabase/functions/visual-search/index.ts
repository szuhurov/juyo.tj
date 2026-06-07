import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts"

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
  "description_en": "EXHAUSTIVE forensic technical string in English for 100% vector matching" 
}`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const formData = await req.formData();
    const image = formData.get('image') as File;
    
    if (!image) throw new Error("No image provided");

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // CONVERT IMAGE TO BASE64 - OPTIMIZED
    const arrayBuffer = await image.arrayBuffer();
    const base64Image = encodeBase64(arrayBuffer);

    // 1. DETAILED FORENSIC ANALYSIS (GPT-4o-Mini - Ultra Fast)
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: MASTER_FORENSIC_PROMPT },
          { role: "user", content: [{ type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}`, detail: "low" } }] }
        ],
        response_format: { type: "json_object" }
      }),
    });

    const aiData = await aiResponse.json();
    
    if (aiData.error) {
      console.error("OpenAI API Error:", aiData.error);
      throw new Error(aiData.error.message || "OpenAI API Error");
    }

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
    
    if (embData.error) {
      console.error("Embedding Error:", embData.error);
      throw new Error(embData.error.message || "Embedding Error");
    }

    const embedding = embData.data[0].embedding;

    // 3. GLOBAL VECTOR SEARCH — search across both lost and found items
    // p_type must match the ENUM values in schema: 'lost' | 'found'
    // We run two searches and merge results for global coverage
    const [lostResults, foundResults] = await Promise.all([
      supabase.rpc('match_item_images', {
        query_embedding: embedding,
        match_threshold: 0.50,
        match_count: 10,
        p_type: 'lost',
      }),
      supabase.rpc('match_item_images', {
        query_embedding: embedding,
        match_threshold: 0.50,
        match_count: 10,
        p_type: 'found',
      }),
    ]);

    const searchError = lostResults.error || foundResults.error;
    const similarItems = [
      ...(lostResults.data || []),
      ...(foundResults.data || []),
    ].sort((a: any, b: any) => b.similarity - a.similarity).slice(0, 20);

    if (searchError) throw searchError;

    const results = (similarItems || []).map((item: any) => ({
      id: item.item_id,
      score: item.similarity,
      title: item.title,
      description: item.description,
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
