import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// MASTER FORENSIC PROMPT (Direct & Focused)
const MASTER_FORENSIC_PROMPT = `You are a forensic expert for JUYO.tj. Analyze the image and provide details in {{LANG}}.
CONTEXT: User is reporting an item as {{TYPE}}.

GUIDELINES:
1. TITLE: Concise (2-4 words) in {{LANG}}.
2. DESCRIPTION: Professional details in {{LANG}}, correct perspective (Lost/Found). Mask serial numbers with XXXX.
3. CATEGORY: One of: Electronics, Documents, Keys, Clothing, Pets, Other.
4. FORENSIC: Technical English string for vector matching.

Return JSON: { 
  "title": "...", 
  "description": "...", 
  "category": "...", 
  "forensic": "..." 
}`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const formData = await req.formData();
    const images = formData.getAll('image') as File[];
    const type = formData.get('type') || 'lost';
    const lang = formData.get('lang') || 'tg';
    const mode = formData.get('mode') || 'full';

    const langMap: Record<string, string> = { tg: 'Tajik', ru: 'Russian', en: 'English' };
    const targetLang = langMap[lang as string] || 'Tajik';
    const typeLabel = type === 'found' ? 'Found (Ёфтшуда)' : 'Lost (Гумшуда)';

    if (!images || images.length === 0) throw new Error("No images provided");

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // CONVERT IMAGES TO BASE64
    const base64Images = await Promise.all(images.map(async (img) => {
      const arrayBuffer = await img.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = "";
      const len = uint8Array.byteLength;
      for (let i = 0; i < len; i++) { binary += String.fromCharCode(uint8Array[i]); }
      return btoa(binary);
    }));

    // 1. MODERATION (GPT-5.5)
    if (mode === 'full' || mode === 'moderation') {
      const imageContent = base64Images.map(b64 => ({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } }));
      const modRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-5.5",
          messages: [
            { 
              role: "system", 
              content: `Content moderator for JUYO (Tajikistan). STICTLY BLOCK: nudity, violence, drugs, weapons, adult items (sex toys, dildos, etc.). Prohibit adult items even if they are made of plastic or appear as toys/silicone. ALLOW documents. Return JSON: { "is_safe": boolean, "reason": "string in ${targetLang}" }` 
            },
            { role: "user", content: imageContent }
          ],
          response_format: { type: "json_object" }
        }),
      });
      
      const modData = await modRes.json();
      const modResult = JSON.parse(modData.choices[0].message.content);
      if (!modResult.is_safe) return new Response(JSON.stringify(modResult), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (mode === 'moderation') return new Response(JSON.stringify({ is_safe: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. FORENSIC ANALYSIS
    const analysisContent = base64Images.map(b64 => ({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}`, detail: "high" } }));
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-5.5",
        reasoning_effort: "medium",
        messages: [
          { role: "system", content: MASTER_FORENSIC_PROMPT.replace(/{{TYPE}}/g, typeLabel).replace(/{{LANG}}/g, targetLang) },
          { role: "user", content: analysisContent }
        ],
        response_format: { type: "json_object" }
      }),
    });

    const aiData = await aiRes.json();
    const result = JSON.parse(aiData.choices[0].message.content);

    // 3. EMBEDDING
    const embRes = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "text-embedding-3-small", input: result.forensic }),
    });
    const embData = await embRes.json();
    const embedding = embData.data[0].embedding;

    // 4. RESPONSE (Flat Structure)
    return new Response(JSON.stringify({
      is_safe: true,
      title: result.title,
      description: result.description,
      category: result.category,
      embedding: embedding
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message, is_safe: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
