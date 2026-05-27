import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts"

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// OPTIMIZED COMBINED PROMPT
const MASTER_PROMPT = `You are an elite forensic AI analyst for JUYO.tj (Tajikistan). 
Analyze ALL images together as one set and provide an EXHAUSTIVE, high-quality description.

CONTEXT: User reports this as {{TYPE}}.
STRICT LANGUAGE: All your output text (reason, title, description) MUST BE IN {{LANG}}.

MODERATION RULES:
1. ALLOWED (is_safe: true): Animals, Electronics, Objects in hands, Documents (even with faces).
2. PROHIBITED (is_safe: false): 18+ content, Violence, Weapons, Drugs, Solo portraits/selfies with no object.

CRITICAL TASKS:
1. MODERATION: Use rules above.
2. DESCRIPTION: Provide a CONCISE, professional description in {{LANG}}.
- STRICT RULE: IGNORE the background, environment, or surroundings (e.g., chairs, tables, floors, people). Focus ONLY on the item itself.
- Paragraph 1: Start DIRECTLY with "Ман {{TYPE_VERB}} [object]..." (e.g., "Ман ёфтам як ҳамёни хурди норанҷӣ..."). 
  - Write 1-2 high-signal sentences about the item's appearance and condition.
  - Talk like a real person writing a post about an item they found or lost.
  - End this paragraph with a semicolon and a final observation about the item's state.
- Bullet Point 1: Start with •. Provide 1-2 sentences about physical details (brands, materials, unique marks). 
- Bullet Point 2: Start with •. Provide 1-2 sentences about text found or specific identifiers.
- MASKING: Replace ALL sensitive numbers, IDs, or specific names with XXXX.
- NO MARKDOWN: Use plain text only.

3. TITLE: 2-4 word plain text title in {{LANG}}. 
- ELECTRONICS RULE: Use general brand/type names (e.g., "iPhone", "Samsung phone") instead of specific model numbers.
- DOCUMENTS: Include the person's name if found.
- NO MARKDOWN.

4. CATEGORY: Electronics, Documents, Keys, Clothing, Pets, or Other.
5. FORENSIC: Technical English keywords of all findings. NO MARKDOWN.

Return JSON:
{
  "is_safe": true,
  "reason": null,
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
    const typeLabel = type === 'found' ? 'Found' : 'Lost';
    
    // Custom verbs for first-person perspective
    const verbs: Record<string, Record<string, string>> = {
      tg: { found: 'ёфтам', lost: 'гум кардам' },
      ru: { found: 'нашёл', lost: 'потерял' },
      en: { found: 'found', lost: 'lost' }
    };
    const currentLang = lang as string || 'tg';
    const typeVerb = verbs[currentLang]?.[type as string] || verbs.tg[type as string];

    const perspective = type === 'found' 
      ? `finder (the person who found the item, e.g., "Ман инро ${verbs[currentLang]?.found || 'ёфтам'}")` 
      : `owner (the person who lost the item, e.g., "Ман инро ${verbs[currentLang]?.lost || 'гум кардам'}")`;

    if (!images || images.length === 0) throw new Error("No images provided");

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // CONVERT IMAGES TO BASE64 - OPTIMIZED for Deno
    const base64Images = await Promise.all(images.map(async (img) => {
      const arrayBuffer = await img.arrayBuffer();
      return encodeBase64(arrayBuffer);
    }));

    const contentPayload = base64Images.map(b64 => ({ 
      type: "image_url", 
      image_url: { 
        url: `data:image/jpeg;base64,${b64}`,
        detail: "low"
      } 
    }));

    // FAST MODERATION PROMPT
    const MODERATION_PROMPT = `You are a common-sense security moderator for JUYO.tj.
STRICT RULES:
1. ALLOWED (is_safe: true):
   - ANIMALS: Dogs, cats, and pets are 100% ALLOWED.
   - ELECTRONICS: Phones, laptops, items held in hands are 100% ALLOWED.
   - DOCUMENTS: Passports/IDs are 100% ALLOWED.
2. PROHIBITED (is_safe: false):
   - 18+ Content (Nudity/Sexual).
   - Violence (Blood/Gore/Corpses).
   - Weapons (Guns/Knives).
   - Drugs.
   - Solo portraits/selfies with no object.
Return JSON ONLY: {"is_safe": true/false, "reason": "Short reason in {{LANG}} or null"}`;

    const promptToUse = mode === 'moderation_only' ? MODERATION_PROMPT : MASTER_PROMPT;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-5.5",
        reasoning_effort: "medium",
        messages: [
          { 
            role: "system", 
            content: promptToUse
              .replace(/{{TYPE}}/g, typeLabel)
              .replace(/{{LANG}}/g, targetLang)
              .replace(/{{PERSPECTIVE}}/g, perspective)
              .replace(/{{TYPE_VERB}}/g, typeVerb)
          },
          { role: "user", content: contentPayload }
        ],
        response_format: { type: "json_object" }
      }),
    });

    const aiData = await aiRes.json();

    if (aiData.error) {
      console.error("OpenAI API Error:", aiData.error);
      throw new Error(aiData.error.message || "OpenAI API Error");
    }

    const result = JSON.parse(aiData.choices[0].message.content);

    // If unsafe, return immediately
    if (!result.is_safe) {
       return new Response(JSON.stringify({ is_safe: false, reason: result.reason }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // For moderation_only, we are done
    if (mode === 'moderation_only') {
      return new Response(JSON.stringify({ is_safe: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // EMBEDDING (Fast and cheap) - Only for full mode
    const embRes = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "text-embedding-3-small", input: result.forensic }),
    });
    const embData = await embRes.json();
    
    if (embData.error) {
       console.error("Embedding Error:", embData.error);
       throw new Error(embData.error.message || "Embedding Error");
    }

    const embedding = embData.data[0].embedding;

    return new Response(JSON.stringify({
      is_safe: true,
      title: result.title,
      description: result.description,
      category: result.category,
      embedding: embedding
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error("AI Brain Error:", error.message);
    return new Response(JSON.stringify({ error: error.message, is_safe: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
