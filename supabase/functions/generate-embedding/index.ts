import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts"

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// MODELS — must be EXACTLY THE SAME as supabase/functions/visual-search.
// The query vector and the stored vector are only comparable if they were
// built from the same model at the same size.
//
// `text-embedding-3-large` with `dimensions: 1536` — higher recall quality
// than `-small`, but the same 1536 size, so the vector(1536) column doesn't
// need to change and a future index remains possible too.
const EMBEDDING_MODEL = "text-embedding-3-large"
const EMBEDDING_DIMENSIONS = 1536
const VISION_MODEL = "gpt-4o-mini"

// FORENSIC PROMPT — kept identical to visual-search.
// Both sides must produce the SAME KIND of text (English forensic
// description + verbatim transcribed text), otherwise the vectors land in
// different regions of the embedding space and never match each other.
const FORENSIC_PROMPT = `You are an elite forensic AI expert specialized in object identification for a lost-and-found platform.
Analyze the image with extreme precision to find unique identifiers. Identify ALL of the following, if visible:
- Brand, Model, precise color shades, material
- Shape, form factor, and style
- Condition/state (new, used, worn, damaged, scratches, dents, stickers)
- ANY visible text, printed or handwritten: names, numbers, serial numbers, document fields, license plate numbers, labels, logos — transcribe exactly as seen, do not translate or normalize

You may also be given the LISTING TEXT that the owner wrote (usually Tajik or Russian).
If present:
- Fold every object-identifying fact from it into your English description (type of object, brand, color, material, distinguishing marks, place).
- Then append the listing text verbatim at the end, unchanged and untranslated.
Ignore contact phone numbers and pure pleading phrases ("please return", "reward") — they identify nothing.

Return JSON: {
  "description_en": "EXHAUSTIVE forensic technical string in English for 100% vector matching, including all transcribed text verbatim"
}`;

async function describeImage(imageUrl: string, listingText: string): Promise<string> {
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Image fetch failed: ${imgRes.status}`);
  const base64Image = encodeBase64(await imgRes.arrayBuffer());

  const content: unknown[] = [
    { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}`, detail: "high" } },
  ];
  if (listingText) {
    content.push({ type: "text", text: `LISTING TEXT (from the owner):\n${listingText}` });
  }

  const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [
        { role: "system", content: FORENSIC_PROMPT },
        { role: "user", content },
      ],
      response_format: { type: "json_object" },
    }),
  });

  const aiData = await aiRes.json();
  if (aiData.error) throw new Error(aiData.error.message);
  return JSON.parse(aiData.choices[0].message.content).description_en ?? "";
}

async function embed(input: string): Promise<number[]> {
  const embRes = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBEDDING_MODEL, dimensions: EMBEDDING_DIMENSIONS, input }),
  });
  const embData = await embRes.json();
  if (embData.error) throw new Error(embData.error.message);
  return embData.data[0].embedding;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // `force` — rebuilds an existing vector (backfill/reprocess).
    // Without it, only images without an embedding are processed.
    const { item_id, text, force } = await req.json();

    if (!item_id) throw new Error("Missing item_id");

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // ALL of the item's images, not just the first one.
    //
    // Previously only the first image got a vector, meaning the second and
    // third images were dead for image search: if a user photographed the
    // same item from a different angle, no match would ever be found.
    const { data: images, error: fetchError } = await supabase
      .from('item_images')
      .select('id, image_url, embedding')
      .eq('item_id', item_id)
      .order('created_at', { ascending: true });

    if (fetchError) throw fetchError;
    if (!images || images.length === 0) {
      return new Response(JSON.stringify({ success: false, message: "No image found" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    const listingText = String(text ?? "").trim();
    let processed = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const image of images) {
      if (image.embedding && !force) { skipped += 1; continue; }

      try {
        const imageDescription = image.image_url
          ? await describeImage(image.image_url, listingText)
          : "";

        // If the image has been described, the listing text is already
        // folded into it — repeating it would weight down the vector with
        // Tajik text and pull it away from the English query space. The raw
        // text is used only as a fallback.
        const embeddingText = imageDescription || listingText;
        if (!embeddingText) { skipped += 1; continue; }

        const embedding = await embed(embeddingText);

        const { error: updateError } = await supabase
          .from('item_images')
          .update({ embedding })
          .eq('id', image.id);

        if (updateError) throw updateError;
        processed += 1;
      } catch (err) {
        errors.push(`${image.id}: ${(err as Error).message}`);
      }
    }

    if (processed === 0 && errors.length > 0) throw new Error(errors.join("; "));

    return new Response(JSON.stringify({
      success: true, total: images.length, processed, skipped, errors,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error("Embedding Function Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
