import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts"

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// MODELS — must be EXACTLY THE SAME as supabase/functions/generate-embedding.
// The query vector and the stored vector are only comparable if they were
// built from the same model at the same size.
const EMBEDDING_MODEL = "text-embedding-3-large"
const EMBEDDING_DIMENSIONS = 1536
const VISION_MODEL = "gpt-4o-mini"

// MASTER FORENSIC PROMPT (Identical to generate-embedding for 100% Match)
const MASTER_FORENSIC_PROMPT = `You are an elite forensic AI expert specialized in object identification for a lost-and-found platform.
Analyze the image with extreme precision to find unique identifiers. Identify ALL of the following, if visible:
- Brand, Model, precise color shades, material
- Shape, form factor, and style
- Condition/state (new, used, worn, damaged, scratches, dents, stickers)
- ANY visible text, printed or handwritten: names, numbers, serial numbers, document fields, license plate numbers, labels, logos — transcribe exactly as seen, do not translate or normalize

IMPORTANT — the input may be a SCREENSHOT of a listing inside an app, not a direct photo:
- Ignore all app interface elements: status bar, buttons, icons, arrows, card borders, tabs, navigation bars, badges such as "Гумшудааст"/"Ёфтшудааст"/"Lost"/"Found", and dates.
- Describe ONLY the real-world object shown in the photo inside that screenshot.
- BUT still transcribe any listing title and description text visible in the screenshot, because it names the same object.
If the image is a normal photo, just describe the object as usual.

Return JSON: {
  "description_en": "EXHAUSTIVE forensic technical string in English for 100% vector matching, including all transcribed text verbatim"
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
        model: VISION_MODEL,
        messages: [
          { role: "system", content: MASTER_FORENSIC_PROMPT },
          { role: "user", content: [{ type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}`, detail: "high" } }] }
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
        model: EMBEDDING_MODEL,
        dimensions: EMBEDDING_DIMENSIONS,
        input: forensicResult.description_en,
      }),
    });

    const embData = await embRes.json();

    if (embData.error) {
      console.error("Embedding Error:", embData.error);
      throw new Error(embData.error.message || "Embedding Error");
    }

    const embedding = embData.data[0].embedding;

    // 3. GLOBAL VECTOR SEARCH
    //
    // A single call with p_type='all' — previously there were two separate
    // calls (lost/found) with a limit of 15 each, which created an
    // artificial split: if all of the top 20 matches were 'lost', five of
    // them would get dropped just to make room for weaker 'found' matches.
    //
    // match_item_images returns only the BEST image from each item,
    // otherwise an item with many images would show up repeatedly in the results.
    const { data: similarItems, error: searchError } = await supabase.rpc('match_item_images', {
      query_embedding: embedding,
      match_threshold: 0.35,
      match_count: 20,
      p_type: 'all',
    });

    if (searchError) throw searchError;

    /**
     * BUG FOUND (user complaint: "results have no image, the date shows as
     * NaN.NaN.NaN"): this used to return only
     * {id, score, title, description, image_url} — a shape COMPLETELY
     * DIFFERENT from the client's `Item` (see lib/services/item-service.ts),
     * which expects `images: {image_url}[]` (not a lone `image_url`) and
     * `date`. `ItemFeedCard` couldn't find an image with this incomplete
     * shape (`images` was empty) and `format(new Date(undefined))` produced
     * Invalid Date.
     *
     * Fix: for the IDs found (already in similarity order from
     * `match_item_images`), we fetch the FULL `items` rows (with their
     * images) — EXACTLY the same shape that the `search_items` RPC (text
     * search) returns — so the client works with no extra mapping needed.
     */
    const itemIds = (similarItems || []).map((it: any) => it.item_id);
    let results: unknown[] = [];

    if (itemIds.length > 0) {
      const { data: fullItems, error: itemsError } = await supabase
        .from('items')
        .select(
          'id, user_id, title, description, category, type, date, reward, ' +
          'created_at, is_resolved, moderation_status, ' +
          'images:item_images(image_url)'
        )
        .in('id', itemIds);

      if (itemsError) throw itemsError;

      const similarityById = new Map(
        (similarItems || []).map((it: any) => [it.item_id, it.similarity]),
      );
      const itemsById = new Map((fullItems || []).map((it: any) => [it.id, it]));

      // The ORIGINAL similarity order (from `match_item_images`) is
      // preserved — not `.in()`'s arbitrary order.
      results = itemIds
        .map((id: string) => itemsById.get(id))
        .filter(Boolean)
        .map((item: any) => ({
          ...item,
          similarity_score: similarityById.get(item.id) ?? null,
        }));
    }

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
