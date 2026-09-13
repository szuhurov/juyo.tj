import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts"

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// МОДЕЛҲО — бояд бо supabase/functions/generate-embedding АЙНАН ЯКХЕЛА бошанд.
// Вектори дархост ва вектори захирашуда танҳо дар сурате муқоисашаванда
// мебошанд, ки аз як модел ва бо як андоза сохта шуда бошанд.
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
    // Як занги ягона бо p_type='all' — пеш аз ин ду занги алоҳида
    // (lost/found) бо ҳадди 15-тоӣ буд, ки тақсимоти сунъӣ месохт:
    // агар ҳамаи 20 мувофиқати беҳтарин 'lost' мебуданд, панҷтоаш
    // партофта мешуд, то ҷой ба 'found'-и заифтар дода шавад.
    //
    // match_item_images аз ҳар ашё танҳо БЕҲТАРИН аксашро бармегардонад,
    // вагарна ашёи серакс якчанд бор дар натиҷа такрор мешуд.
    const { data: similarItems, error: searchError } = await supabase.rpc('match_item_images', {
      query_embedding: embedding,
      match_threshold: 0.35,
      match_count: 20,
      p_type: 'all',
    });

    if (searchError) throw searchError;

    /**
     * ХАТОГИИ ЁФТШУДА (талаби корбар: "натиҷаҳо акс надоранд, санааш
     * NaN.NaN.NaN аст"): пештар ин ҷо танҳо
     * {id, score, title, description, image_url} бармегашт — шакли
     * КОМИЛАН ФАРҚ аз `Item`-и клиент (ниг. lib/services/item-service.ts),
     * ки `images: {image_url}[]` (на `image_url`-и танҳо) ва `date`
     * мехоҳад. `ItemFeedCard` бо ин шакли нотамом акс намеёфт (`images`
     * холӣ буд) ва `format(new Date(undefined))` → Invalid Date медод.
     *
     * Ҳал: барои ID-ҳои ёфтшуда (аз рӯи тартиби similarity аллакай аз
     * `match_item_images` омада) сатрҳои ПУРРАи `items` (бо аксҳояшон)
     * мегирем — АЙНАН ҳамон шакле, ки `search_items` RPC (ҷустуҷӯи
     * матнӣ) медиҳад — то клиент бе ҳеҷ харитасозии иловагӣ кор кунад.
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

      // Тартиби АСЛИИ similarity (аз `match_item_images`) нигоҳ дошта
      // мешавад — на тартиби худсарии `.in()`.
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
