const SIGHTENGINE_API_USER = Deno.env.get('SIGHTENGINE_API_USER')
const SIGHTENGINE_API_SECRET = Deno.env.get('SIGHTENGINE_API_SECRET')
const SIGHTENGINE_LIST_ID = Deno.env.get('SIGHTENGINE_LIST_ID')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log("--- Visual Search Start ---");
    
    if (!SIGHTENGINE_API_USER || !SIGHTENGINE_API_SECRET || !SIGHTENGINE_LIST_ID) {
      throw new Error("API Keys or List ID are missing in Supabase Secrets");
    }

    const formData = await req.formData();
    const image = formData.get('image');

    if (!image) {
      return new Response(JSON.stringify({ error: "No image provided" }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log("Calling Sightengine Check API with Lists...");
    const sightengineFormData = new FormData();
    sightengineFormData.append('api_user', SIGHTENGINE_API_USER);
    sightengineFormData.append('api_secret', SIGHTENGINE_API_SECRET);
    sightengineFormData.append('lists', SIGHTENGINE_LIST_ID);
    sightengineFormData.append('media', image);

    // Усули стандартии check.json барои муқоиса бо рӯйхатҳо (lists)
    const response = await fetch("https://api.sightengine.com/1.0/check.json", {
      method: 'POST',
      body: sightengineFormData
    });

    const data = await response.json();
    console.log("Sightengine Status:", data.status);

    if (data.status !== 'success') {
      throw new Error(data.error?.message || "Sightengine returned error status");
    }

    // Дар ин усул натиҷаҳо дар дохили объекти 'similarity' меоянд
    const similarity = data.similarity || [];
    const matches = similarity.length > 0 ? similarity[0].matches : [];
    
    const results = matches
      .filter((match: any) => match.score >= 0.30) // Ҳадди ақал 30% барои нишон додани натиҷаҳои воқеӣ
      .map((match: any) => ({
        id: match.custom_id,
        score: match.score
      }));

    console.log("Found matches:", results.length);

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error("Critical Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
})
