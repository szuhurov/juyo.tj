const SIGHTENGINE_API_USER = Deno.env.get('SIGHTENGINE_API_USER')
const SIGHTENGINE_API_SECRET = Deno.env.get('SIGHTENGINE_API_SECRET')
const SIGHTENGINE_LIST_ID = Deno.env.get('SIGHTENGINE_LIST_ID')
const GOOGLE_VISION_API_KEY = Deno.env.get('GOOGLE_VISION_API_KEY')
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

    const arrayBuffer = await image.arrayBuffer();
    const base64Image = btoa(Array.from(new Uint8Array(arrayBuffer)).map(b => String.fromCharCode(b)).join(''));

    // 1. DEEP GOOGLE ANALYSIS
    console.log("Starting Deep AI Analysis...");
    const visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
      {
        method: 'POST',
        body: JSON.stringify({
          requests: [{
            image: { content: base64Image },
            features: [
              { type: 'WEB_DETECTION', maxResults: 15 },
              { type: 'LABEL_DETECTION', maxResults: 15 },
              { type: 'LOGO_DETECTION', maxResults: 5 },
              { type: 'OBJECT_LOCALIZATION', maxResults: 5 }
            ]
          }]
        })
      }
    );
    const visionData = await visionResponse.json();
    const res = visionData.responses[0];
    
    const keywords = [
      ...(res.logoAnnotations || []).map((l: any) => l.description),
      ...(res.localizedObjectAnnotations || []).map((o: any) => o.name),
      ...(res.webDetection?.webEntities || []).map((e: any) => e.description),
      ...(res.labelAnnotations || []).map((l: any) => l.description)
    ].filter(Boolean).map(k => k.trim().toLowerCase());

    const uniqueKeywords = [...new Set(keywords)].filter(k => k.length >= 3);
    console.log("AI Semantic Fingerprint:", uniqueKeywords.join(", "));

    // 2. SIGHTENGINE VISUAL MATCH
    console.log("Checking Visual Fingerprints...");
    const seFormData = new FormData();
    seFormData.append('api_user', SIGHTENGINE_API_USER!);
    seFormData.append('api_secret', SIGHTENGINE_API_SECRET!);
    seFormData.append('lists', SIGHTENGINE_LIST_ID!);
    seFormData.append('media', image);

    const seResponse = await fetch("https://api.sightengine.com/1.0/check.json", { method: 'POST', body: seFormData });
    const seData = await seResponse.json();
    const seMatches = (seData.similarity && seData.similarity[0]?.matches) || [];

    // 3. SMART MERGE & DATABASE QUERY
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const resultsMap = new Map();

    // Иловаи натиҷаҳои Sightengine (Visual)
    seMatches.filter((m: any) => m.score >= 0.1).forEach((m: any) => {
      resultsMap.set(m.custom_id, { id: m.custom_id, score: m.score, source: 'visual' });
    });

    // Ҷустуҷӯи Семантикӣ дар База
    if (uniqueKeywords.length > 0) {
      const searchQuery = uniqueKeywords.slice(0, 8).join(' | ');
      const { data: dbItems } = await supabase
        .from('items')
        .select('id, title, ai_labels')
        .eq('is_resolved', false)
        .eq('moderation_status', 'approved')
        .textSearch('search_vector', searchQuery, { config: 'simple' })
        .limit(50);

      if (dbItems) {
        dbItems.forEach(item => {
          const existing = resultsMap.get(item.id);
          if (existing) {
            // Агар ҳарду ёфта бошанд - ин беҳтарин натиҷа аст (Boost Score)
            existing.score = Math.min(0.99, existing.score + 0.4);
            existing.source = 'top_match';
          } else {
            resultsMap.set(item.id, { id: item.id, score: 0.55, source: 'semantic' });
          }
        });
      }
    }

    const finalResults = Array.from(resultsMap.values()).sort((a, b) => b.score - a.score);
    console.log(`Delivering ${finalResults.length} high-quality matches.`);

    return new Response(JSON.stringify({ results: finalResults }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error("Super-Hybrid Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
