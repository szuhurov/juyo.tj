const SIGHTENGINE_API_USER = Deno.env.get('SIGHTENGINE_API_USER')
const SIGHTENGINE_API_SECRET = Deno.env.get('SIGHTENGINE_API_SECRET')
const SIGHTENGINE_LIST_ID = Deno.env.get('SIGHTENGINE_LIST_ID')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const formData = await req.formData();
    const image = formData.get('image') as File;
    if (!image) throw new Error("No image provided");

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // 1. SIGHTENGINE VISUAL MATCH
    const seFormData = new FormData();
    seFormData.append('api_user', SIGHTENGINE_API_USER!);
    seFormData.append('api_secret', SIGHTENGINE_API_SECRET!);
    seFormData.append('lists', SIGHTENGINE_LIST_ID!);
    seFormData.append('media', image);

    const seResponse = await fetch("https://api.sightengine.com/1.0/check.json", { method: 'POST', body: seFormData });
    const seData = await seResponse.json();
    
    if (seData.status !== 'success') throw new Error("Sightengine API Error");

    const seMatches = (seData.similarity && seData.similarity[0]?.matches) || [];
    if (seMatches.length === 0) return new Response(JSON.stringify({ results: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // 2. FIND ITEM IDs FROM IMAGE IDs
    const imageIds = seMatches.map((m: any) => m.custom_id);
    
    const { data: imageRecords, error: dbError } = await supabase
      .from('item_images')
      .select('item_id, id')
      .in('id', imageIds);

    if (dbError) throw dbError;

    // 3. MAP MATCHES TO ITEM IDs
    const finalResults = seMatches
      .filter((m: any) => m.score >= 0.15)
      .map((m: any) => {
        const record = imageRecords?.find(r => r.id === m.custom_id);
        if (record) {
          return { id: record.item_id, score: m.score, source: 'sightengine_v2' };
        }
        return null;
      })
      .filter(Boolean);

    return new Response(JSON.stringify({ results: finalResults }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error("Visual Search Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
