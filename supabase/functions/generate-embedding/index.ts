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
    const { item_id, text } = await req.json();

    if (!item_id || !text) {
      throw new Error("Missing item_id or text");
    }


    // 1. Generate Embedding from OpenAI
    const embRes = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ 
        model: "text-embedding-3-small", 
        input: text 
      }),
    });
    
    const embData = await embRes.json();
    if (embData.error) throw new Error(embData.error.message);

    const embedding = embData.data[0].embedding;

    // 2. Update the item in Database
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    // We update the embedding in the 'item_images' table (specifically the first image)
    // or we could add an 'embedding' column to the 'items' table for better architecture.
    // Based on existing code, it seems embeddings are stored in 'item_images'.
    
    const { data: firstImage, error: fetchError } = await supabase
      .from('item_images')
      .select('id')
      .eq('item_id', item_id)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (fetchError || !firstImage) {
        console.error("No image found for item to attach embedding.");
        return new Response(JSON.stringify({ success: false, message: "No image found" }), { status: 404 });
    }

    const { error: updateError } = await supabase
      .from('item_images')
      .update({ embedding: embedding })
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
