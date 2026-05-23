import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const formData = await req.formData();
    const image = formData.get('image') as File;
    const type = formData.get('type') || 'lost'; // 'lost' or 'found'

    if (!image) throw new Error("No image provided");

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // 1. CONVERT IMAGE TO BASE64 FOR OPENAI
    const arrayBuffer = await image.arrayBuffer();
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    // 2. CALL OPENAI GPT-4o (The Flagship Model)
    // We ask it to: 1. Describe, 2. Categorize, 3. Check for duplicates (logic)
    const aiResponse = await fetch("https://api.openai.com/1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert AI for a 'Lost and Found' platform in Tajikistan. Your task is to analyze images of lost or found items. Provide a detailed description in Tajik, suggest a category, and identify key searchable features."
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this image of a ${type} item. Return a JSON object with: 
                {
                  "description_tj": "detailed description in Tajik",
                  "category": "one of: electronics, documents, pets, keys, bags, clothing, others",
                  "tags": ["tag1", "tag2"],
                  "is_appropriate": true/false
                }`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        response_format: { type: "json_object" }
      }),
    });

    const aiData = await aiResponse.json();
    const analysis = JSON.parse(aiData.choices[0].message.content);

    if (!analysis.is_appropriate) {
      return new Response(JSON.stringify({ error: "Content not appropriate", code: "MODERATION_FAILED" }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // 3. GENERATE EMBEDDING FOR THE DESCRIPTION (Vector Search)
    const embeddingResponse = await fetch("https://api.openai.com/1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: analysis.description_tj,
      }),
    });

    const embeddingData = await embeddingResponse.json();
    const embedding = embeddingData.data[0].embedding;

    // 4. FIND SIMILAR ITEMS USING VECTOR SEARCH (RPC)
    const searchType = type === 'found' ? 'lost' : 'found';
    
    const { data: similarItems, error: searchError } = await supabase.rpc('match_item_images', {
      query_embedding: embedding,
      match_threshold: 0.35, // Adjust sensitivity
      match_count: 3,
      p_type: searchType
    });

    return new Response(JSON.stringify({
      analysis,
      similarItems: similarItems || [],
      message: similarItems && similarItems.length > 0 
        ? "Мо чизҳои монандро ёфтем!" 
        : "Чизи монанд ёфт нашуд, метавонед эълон гузоред."
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error("AI Brain Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
