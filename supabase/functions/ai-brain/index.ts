import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// OPTIMIZED COMBINED PROMPT
const MASTER_PROMPT = `You are an expert moderator and forensic analyst for JUYO.tj (Tajikistan). 
Analyze ALL images together as one set.

CONTEXT: User reports this as {{TYPE}}.

CRITICAL TASKS:
1. MODERATION: Check for nudity, violence, drugs, weapons, or adult items. If unsafe, set is_safe=false and provide a brief reason. If safe, is_safe=true. (Documents are safe).
2. EXTRACTION: Find any FULL NAMES on documents (Passports, IDs).
3. DESCRIPTION: Combine details from all images into a cohesive description from the {{PERSPECTIVE}} perspective. Mask sensitive IDs/Serials with XXXX. Keep names visible. Use 2 bullet points and 2 emojis. STRICTLY NO MARKDOWN (no **, #, _).
4. TITLE: 2-4 word plain text title in {{LANG}}. Include extracted name if it's a document. NO MARKDOWN.
5. CATEGORY: Electronics, Documents, Keys, Clothing, Pets, or Other.
6. FORENSIC: Technical English keywords of all findings. NO MARKDOWN.

Return JSON EXACTLY like this:
{
  "is_safe": true/false,
  "reason": "String or null",
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

    const langMap: Record<string, string> = { tg: 'Tajik', ru: 'Russian', en: 'English' };
    const targetLang = langMap[lang as string] || 'Tajik';
    const typeLabel = type === 'found' ? 'Found' : 'Lost';
    const perspective = type === 'found' ? 'finder (e.g., "Ман инро ёфтам")' : 'owner (e.g., "Гум кардам")';

    if (!images || images.length === 0) throw new Error("No images provided");

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // CONVERT IMAGES TO BASE64
    const base64Images = await Promise.all(images.map(async (img) => {
      const arrayBuffer = await img.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < uint8Array.byteLength; i++) { binary += String.fromCharCode(uint8Array[i]); }
      return btoa(binary);
    }));

    // SINGLE OPTIMIZED API CALL
    const contentPayload = base64Images.map(b64 => ({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } }));
    
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-5.5",
        messages: [
          { role: "system", content: MASTER_PROMPT.replace(/{{TYPE}}/g, typeLabel).replace(/{{LANG}}/g, targetLang).replace(/{{PERSPECTIVE}}/g, perspective) },
          { role: "user", content: contentPayload }
        ],
        response_format: { type: "json_object" }
      }),
    });

    const aiData = await aiRes.json();
    const result = JSON.parse(aiData.choices[0].message.content);

    // If unsafe, return immediately without embedding
    if (!result.is_safe) {
       return new Response(JSON.stringify({ is_safe: false, reason: result.reason }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // EMBEDDING (Fast and cheap)
    const embRes = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "text-embedding-3-small", input: result.forensic }),
    });
    const embData = await embRes.json();
    const embedding = embData.data[0].embedding;

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
