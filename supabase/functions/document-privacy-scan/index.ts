/**
 * Санҷиши AI барои ҳимояи махфият дар ҳуҷҷатҳо. Ин функсия акси
 * боркардашударо (пеш аз upload ба storage-и ҷамъиятӣ) месанҷад ва агар
 * он ҳуҷҷати расмӣ бошад (шиноснома, шаҳодатнома, шаҳодатномаи ронандагӣ,
 * корти бонкӣ ва ғайра), майдонҳои махфиро ҳамчун rectangle-ҳои
 * нормализатсияшуда (0-1 нисбат ба андозаи акс) бармегардонад — то
 * клиент онҳоро blur/pixelate кунад. Худи AI акси навро НАМЕСОЗАД, танҳо
 * координатаҳоро муайян мекунад.
 */
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts"

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PRIVACY_SCAN_PROMPT = `You are a document privacy analyst. Look at the attached image and determine whether it shows an OFFICIAL DOCUMENT: a passport, national ID card, driver's license, residence permit, student card, bank/payment card, insurance card, or similar official document.

If it is NOT such a document (e.g. a photo of a lost item, pet, clothing, electronics, keys, etc. with no document visible), return:
{"is_document": false, "document_type": null, "regions": []}

If it IS such a document, locate every field that is a unique identifier that could be used for identity theft or fraud, and return a tight bounding box for EACH one. Bounding box coordinates must be FRACTIONS of the image width/height, between 0 and 1, where (x, y) is the TOP-LEFT corner of the box, and width/height are also fractions of the full image size.

MUST BLUR (create a region for each one visible):
- Passport number
- National ID number / personal identification number
- Driver's license number
- Bank/payment card number
- CVV / CVC security code
- IBAN or bank account number
- QR codes
- Barcodes
- MRZ (the Machine Readable Zone — the row(s) of monospace characters/chevrons at the bottom of passports and ID cards)
- Any other serial number or unique identifier code

MUST STAY VISIBLE — do NOT create a region for these:
- The person's photo/portrait on the document
- Full name
- Date of birth

Return JSON ONLY in this exact shape:
{
  "is_document": true,
  "document_type": "passport" | "national_id" | "drivers_license" | "residence_permit" | "student_card" | "bank_card" | "insurance_card" | "other_document",
  "regions": [
    { "label": "passport_number", "x": 0.12, "y": 0.34, "width": 0.30, "height": 0.05 }
  ]
}`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const formData = await req.formData();
    const image = formData.get('image') as File | null;
    if (!image) throw new Error("No image provided");

    const arrayBuffer = await image.arrayBuffer();
    const base64 = encodeBase64(arrayBuffer);

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-5.5",
        reasoning_effort: "medium",
        messages: [
          { role: "system", content: PRIVACY_SCAN_PROMPT },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}`, detail: "high" } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    const aiData = await aiRes.json();
    if (aiData.error) {
      console.error("OpenAI API Error:", aiData.error);
      throw new Error(aiData.error.message || "OpenAI API Error");
    }

    const result = JSON.parse(aiData.choices[0].message.content);

    // Санҷиши сохти минимиалӣ — то натиҷаи бадшакл сабаби crash дар клиент нашавад.
    const regions = Array.isArray(result.regions)
      ? result.regions
          .filter((r: any) =>
            typeof r?.x === "number" && typeof r?.y === "number" &&
            typeof r?.width === "number" && typeof r?.height === "number",
          )
          .map((r: any) => ({
            label: typeof r.label === "string" ? r.label : "sensitive",
            x: Math.max(0, Math.min(1, r.x)),
            y: Math.max(0, Math.min(1, r.y)),
            width: Math.max(0, Math.min(1 - Math.max(0, Math.min(1, r.x)), r.width)),
            height: Math.max(0, Math.min(1 - Math.max(0, Math.min(1, r.y)), r.height)),
          }))
      : [];

    return new Response(
      JSON.stringify({
        is_document: !!result.is_document,
        document_type: result.document_type ?? null,
        regions,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    console.error("Privacy Scan Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message, is_document: false, regions: [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
