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
    const images = formData.getAll('image') as File[];
    if (!images || images.length === 0) throw new Error("No images provided");

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const resultsMap = new Map();
    const allUniqueKeywords = new Set<string>();

    // Таҳлили ҳамаи аксҳои боршуда
    for (const image of images) {
      const arrayBuffer = await image.arrayBuffer();
      const base64Image = btoa(Array.from(new Uint8Array(arrayBuffer)).map(b => String.fromCharCode(b)).join(''));

      // 1. DEEP GOOGLE ANALYSIS
      console.log(`Starting Deep AI Analysis for image...`);
      try {
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

        keywords.forEach(k => {
          if (k.length >= 3) allUniqueKeywords.add(k);
        });
      } catch (e) {
        console.error("Google Vision Error:", e.message);
      }

      // 2. SIGHTENGINE VISUAL MATCH
      console.log("Checking Visual Fingerprints...");
      try {
        const seFormData = new FormData();
        seFormData.append('api_user', SIGHTENGINE_API_USER!);
        seFormData.append('api_secret', SIGHTENGINE_API_SECRET!);
        seFormData.append('lists', SIGHTENGINE_LIST_ID!);
        seFormData.append('media', image);

        const seResponse = await fetch("https://api.sightengine.com/1.0/check.json", { method: 'POST', body: seFormData });
        const seData = await seResponse.json();
        const seMatches = (seData.similarity && seData.similarity[0]?.matches) || [];

        seMatches.forEach((m: any) => {
          if (m.score >= 0.10) {
            const existing = resultsMap.get(m.custom_id);
            if (!existing || m.score > existing.score) {
              resultsMap.set(m.custom_id, { id: m.custom_id, score: m.score, source: 'visual' });
            }
          }
        });
      } catch (e) {
        console.error("Sightengine Error:", e.message);
      }
    }

    const uniqueKeywords = Array.from(allUniqueKeywords);
    console.log("Global AI Semantic Fingerprint:", uniqueKeywords.join(", "));

    // 3. SMART MERGE & DATABASE QUERY
    if (uniqueKeywords.length > 0) {
      const searchQuery = uniqueKeywords.slice(0, 15).join(' | ');
      
      // Ҷустуҷӯи Семантикӣ дар База
      // Мо инчунин ai_labels-ро мегирем барои муқоисаи дақиқтар
      const { data: dbItems } = await supabase
        .from('items')
        .select('id, title, description, ai_labels')
        .eq('is_resolved', false)
        .eq('moderation_status', 'approved')
        .textSearch('search_vector', searchQuery, { config: 'simple' })
        .limit(100);

      if (dbItems) {
        dbItems.forEach(item => {
          // Ҳисоб кардани хол (score) аз рӯи мувофиқати калимаҳо
          const itemText = `${item.title} ${item.description} ${item.ai_labels || ''}`.toLowerCase();
          let matchCount = 0;
          uniqueKeywords.forEach(kw => {
            if (itemText.includes(kw)) matchCount++;
          });

          const semanticScore = Math.min(0.9, (matchCount / Math.max(uniqueKeywords.length, 5)) * 0.8 + 0.2);

          const existing = resultsMap.get(item.id);
          if (existing) {
            // Агар ҳам визуалӣ ва ҳам семантикӣ мувофиқ ояд - холро баланд мекунем (Boost)
            // Аммо на ба таври якбора ба 99%, балки вобаста ба сифати мувофиқат
            existing.score = Math.min(0.99, existing.score * 0.6 + semanticScore * 0.4 + 0.1);
            existing.source = 'top_match';
          } else if (semanticScore > 0.3) {
            // Агар танҳо семантикӣ бошад
            resultsMap.set(item.id, { id: item.id, score: semanticScore, source: 'semantic' });
          }
        });
      }
    }

    // 4. Табдил ба массив ва Тартиб додани қатъӣ аз рӯи хол (Score)
    const finalResults = Array.from(resultsMap.values())
      .filter(r => r.score >= 0.25) // Танҳо натиҷаҳои боэътимодро мемонем
      .sort((a, b) => b.score - a.score);

    console.log(`Total results found: ${finalResults.length}`);
    finalResults.slice(0, 5).forEach(r => console.log(`ID: ${r.id}, Score: ${r.score}`));

    return new Response(JSON.stringify({ results: finalResults }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error("Super-Hybrid Visual Search Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
