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

MODERATION RULES (CRITICAL):
1. CONTEXTUAL SAFETY: This is a LOST & FOUND app. Identity documents (Passports, ID cards) are MANDATORY and 100% SAFE.
2. ALLOWED (is_safe: true): 
   - DOCUMENTS: Passports, ID cards, Driver Licenses, Student IDs, Bank cards are the HIGHEST PRIORITY and ALWAYS ALLOWED.
   - Everyday items: Real pets, electronics, keys, clothing.
3. PROHIBITED (is_safe: false):
   - Nudity, extreme violence (blood/gore), illegal weapons, or narcotics.

If a document is detected, ALWAYS set is_safe: true.

CRITICAL TASKS:
1. MODERATION: Documents are ALWAYS SAFE.
2. DESCRIPTION: Provide a CONCISE, professional description in {{LANG}}.
- STRICT RULE: IGNORE the background surroundings. Focus ONLY on the item.
- Paragraph 1: Start DIRECTLY with "{{START_PHRASE}} [object]..." (e.g., "Ман ёфтам як ҳамёни хурди норанҷӣ..."). 
  - Write 1-2 high-signal sentences about the item's appearance and condition.
  - Talk like a real person writing a post about an item they found or lost.
  - End this paragraph with a semicolon and a final observation about the item's state.
- Bullet Point 1: Start with •. Provide 1-2 sentences about physical details (brands, materials, unique marks). 
- Bullet Point 2: Start with •. Provide 1-2 sentences about text found or specific identifiers.
- MASKING: Replace ALL sensitive numbers and ID/Passport numbers with XXXX. 
- EXCEPTION FOR DOCUMENTS: If you detect a document, you MUST find the OWNER'S NAME on it. Include this NAME in both the title and description. This is CRITICAL for the owner to find their item. Do NOT mask the name in documents.
- NO MARKDOWN: Use plain text only.

3. TITLE: 2-4 word plain text title in {{LANG}}. 
- DOCUMENT RULE: If it's a document, the title MUST include the type and the NAME found (e.g., "ID Card Ivan Ivanov").
- ELECTRONICS RULE: Use brand names (e.g., "iPhone", "Samsung").
- NO COLONS. NO MARKDOWN.

4. CATEGORY: Electronics, Documents, Keys, Clothing, Pets, or Other.
5. FORENSIC: EXHAUSTIVE forensic technical string in English for 100% vector matching. Identify: Brand, Model, Precise Color shades, Material, and UNIQUE SIGNS (scratches, dents, stickers, wear). NO MARKDOWN.

Return JSON:
{
  "is_safe": true,
  "reason": null,
  "title": "...",
  "description": "...",
  "category": "...",
  "forensic": "..."
}
`;

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
    
    // Custom start phrases for first-person perspective
    const startPhrases: Record<string, Record<string, string>> = {
      tg: { found: 'Ман ёфтам', lost: 'Ман гум кардам' },
      ru: { found: 'Я нашёл', lost: 'Я потерял' },
      en: { found: 'I found', lost: 'I lost' }
    };
    const currentLang = lang as string || 'tg';
    const startPhrase = startPhrases[currentLang]?.[type as string] || startPhrases.tg[type as string];

    const perspective = type === 'found' 
      ? `finder (the person who found the item, e.g., "${startPhrases[currentLang]?.found || 'Ман ёфтам'}")` 
      : `owner (the person who lost the item, e.g., "${startPhrases[currentLang]?.lost || 'Ман гум кардам'}")`;

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
        detail: "auto"
      } 
    }));

    // Shared instructions for is_document text handling — reused by both
    // MODERATION_PROMPT and FINAL_CHECK_PROMPT so text privacy behaves
    // identically regardless of which flow (add/edit/safety-box) triggered it.
    const DOCUMENT_TEXT_RULES = `IF is_document IS TRUE, ALSO check TEXT TITLE and TEXT DESCRIPTION above for any raw document/passport/ID/license/card number or series number written out as text. If found, return redacted_title and redacted_description with ONLY that exact number sequence removed (delete it and naturally clean up any leftover stray punctuation/spacing) — do NOT remove or alter the person's name/surname (names must always stay, exactly like in the image), and do NOT change anything else in the text. If nothing needs to be removed, redacted_title/redacted_description must equal the original text unchanged.
ALSO DETERMINE, when is_document is true: is the document ITSELF a full passport or a birth certificate? If the document is something else that serves as identity-adjacent proof (e.g. driver's license, student ID, work ID/badge, military ID, insurance card, diploma) rather than the passport/birth certificate itself, set document_needs_id_proof to true — the finder should also ask the claimant to show their passport/birth certificate as extra proof of identity. If the document IS itself a passport or birth certificate, or is_document is false, set document_needs_id_proof to false.`;

    // FAST MODERATION PROMPT
    const MODERATION_PROMPT = `You are a moderator for a LOST & FOUND app.
IDENTITY DOCUMENTS (Passports, ID cards, Licenses) are the MOST IMPORTANT items and are 100% SAFE and ALLOWED.

TEXT TITLE: {{FINAL_TITLE}}
TEXT DESCRIPTION: {{FINAL_DESCRIPTION}}

STRICT RULES:
1. ALLOWED (is_safe: true):
   - DOCUMENTS: Passports, ID cards, Student IDs, Bank cards are 100% ALLOWED.
   - ANIMALS & ELECTRONICS: 100% ALLOWED.
   - A hand or body part visibly holding/wearing the lost/found item is fine.
2. PROHIBITED: 18+, extreme violence, illegal weapons, or a selfie/full-body/portrait photo where a PERSON (not the item) is the main subject.
ALSO DETERMINE: is any attached image an official document (passport, national ID, driver's license, residence permit, student card, bank/payment card, insurance card, or similar official document with a photo/printed personal data)? Set is_document accordingly.
IF is_document IS TRUE, also locate every field that is a unique identifier that could be used for identity theft or fraud (passport/ID/license/card number, CVV/CVC, IBAN/account number, QR code, barcode, MRZ — the machine-readable row(s) of monospace text at the bottom of passports/IDs — or any other serial/unique number), and return a bounding box for EACH one in privacy_regions, as FRACTIONS of the image width/height (0 to 1, x/y = top-left corner). Each box must be a SMALL, TIGHT box around ONLY that one specific number/code field — never a large region that sweeps across nearby text too. A small margin around the field is fine, but do not enlarge the box beyond what is needed to fully cover that field's text.

CRITICAL — NEVER cover, and NEVER let any privacy_region overlap even partially with: the person's PHOTO, their FULL NAME / SURNAME / FATHER'S NAME (in every alphabet it is printed in — e.g. both Cyrillic and Latin rows), or their DATE OF BIRTH. These identify the item so its rightful owner can recognize it and must always stay fully readable. If is_document is false, or no qualifying number/code fields are visible, privacy_regions must be [].
${DOCUMENT_TEXT_RULES}
Return JSON ONLY: {"is_safe": true/false, "reason": "Short reason in {{LANG}} or null", "is_document": true/false, "document_needs_id_proof": true/false, "privacy_regions": [{"label": "passport_number", "x": 0.1, "y": 0.3, "width": 0.3, "height": 0.05}], "redacted_title": "...", "redacted_description": "..."}`;

    // SUGGEST-ONLY PROMPT — pure vision auto-fill, no moderation verdict at all.
    // Used for the early "analyzing photo" step so it never blocks the user;
    // the one and only accept/reject decision happens later, in final_check.
    const SUGGEST_PROMPT = `You are an elite forensic AI analyst for JUYO.tj (Tajikistan).
Analyze ALL images together as one set and provide an EXHAUSTIVE, high-quality description.
Do NOT perform any moderation or safety judgement — only describe what you see.

CONTEXT: User reports this as {{TYPE}}.
STRICT LANGUAGE: All your output text (title, description) MUST BE IN {{LANG}}.

TASKS:
1. DESCRIPTION: Provide a CONCISE, professional description in {{LANG}}.
- STRICT RULE: IGNORE the background surroundings. Focus ONLY on the item.
- Paragraph 1: Start DIRECTLY with "{{START_PHRASE}} [object]..." (e.g., "Ман ёфтам як ҳамёни хурди норанҷӣ...").
  - Write 1-2 high-signal sentences about the item's appearance and condition.
  - Talk like a real person writing a post about an item they found or lost.
  - End this paragraph with a semicolon and a final observation about the item's state.
- Bullet Point 1: Start with •. Provide 1-2 sentences about physical details (brands, materials, unique marks).
- Bullet Point 2: Start with •. Provide 1-2 sentences about text found or specific identifiers.
- MASKING: Replace ALL sensitive numbers and ID/Passport numbers with XXXX.
- EXCEPTION FOR DOCUMENTS: If you detect a document, you MUST find the OWNER'S NAME on it. Include this NAME in both the title and description. Do NOT mask the name in documents.
- NO MARKDOWN: Use plain text only.
2. TITLE: 2-4 word plain text title in {{LANG}}.
- DOCUMENT RULE: If it's a document, the title MUST include the type and the NAME found.
- ELECTRONICS RULE: Use brand names (e.g., "iPhone", "Samsung").
- NO COLONS. NO MARKDOWN.
3. CATEGORY: Electronics, Documents, Keys, Clothing, Pets, or Other.
4. FORENSIC: EXHAUSTIVE forensic technical string in English for 100% vector matching. Identify: Brand, Model, Precise Color shades, Material, and UNIQUE SIGNS (scratches, dents, stickers, wear). NO MARKDOWN.

Return JSON:
{ "title": "...", "description": "...", "category": "...", "forensic": "..." }`;

    // FINAL-CHECK PROMPT — the single moderation gate. Runs once, right
    // before publish, against the user's FINAL images + FINAL text together
    // (whatever they ended up editing), so there is exactly one AI safety
    // decision per submission instead of an early image check plus a later
    // separate text check.
    const FINAL_CHECK_PROMPT = `You are a moderator for a LOST & FOUND app (JUYO.tj).
Review the attached image(s) AND the text below TOGETHER as one submission.

TEXT TITLE: {{FINAL_TITLE}}
TEXT DESCRIPTION: {{FINAL_DESCRIPTION}}

IMAGE RULES:
1. ALLOWED (is_safe: true): DOCUMENTS (passports, ID cards, licenses, bank cards), animals, electronics, everyday items. A hand or body part visibly holding/wearing the lost/found item is fine.
2. PROHIBITED: Nudity, extreme violence/gore, illegal weapons, narcotics. Also PROHIBITED: a selfie or full-body/portrait photo where a PERSON (not the item) is the main subject of the photo.

TEXT RULES:
1. PROHIBITED: profanity/harassment, illegal trade (drugs/weapons/tracked goods), scams/fraud, hate speech.
2. ALLOWED: normal contextual mentions (e.g. "found a kitchen knife" describing a household item), normal frustration without targeting individuals.

If the text is not already in {{LANG}}, still judge it, but write "reason" in {{LANG}}.
If unsafe, identify the SPECIFIC problematic part (image or text) in "reason", quoting the exact original text if it's a text violation.

ALSO DETERMINE: is any attached image an official document (passport, national ID, driver's license, residence permit, student card, bank/payment card, insurance card, or similar official document with a photo/printed personal data)? Set is_document accordingly — this is independent of is_safe.
IF is_document IS TRUE, also locate every field that is a unique identifier that could be used for identity theft or fraud (passport/ID/license/card number, CVV/CVC, IBAN/account number, QR code, barcode, MRZ — the machine-readable row(s) of monospace text at the bottom of passports/IDs — or any other serial/unique number), and return a bounding box for EACH one in privacy_regions, as FRACTIONS of the image width/height (0 to 1, x/y = top-left corner). Each box must be a SMALL, TIGHT box around ONLY that one specific number/code field — never a large region that sweeps across nearby text too. A small margin around the field is fine, but do not enlarge the box beyond what is needed to fully cover that field's text.

CRITICAL — NEVER cover, and NEVER let any privacy_region overlap even partially with: the person's PHOTO, their FULL NAME / SURNAME / FATHER'S NAME (in every alphabet it is printed in — e.g. both Cyrillic and Latin rows), or their DATE OF BIRTH. These identify the item so its rightful owner can recognize it and must always stay fully readable. If is_document is false, or no qualifying number/code fields are visible, privacy_regions must be [].
${DOCUMENT_TEXT_RULES}

Return JSON ONLY: {"is_safe": true/false, "reason": "Short reason in {{LANG}} or null", "is_document": true/false, "document_needs_id_proof": true/false, "privacy_regions": [{"label": "passport_number", "x": 0.1, "y": 0.3, "width": 0.3, "height": 0.05}], "redacted_title": "...", "redacted_description": "..."}`;

    let promptToUse = MASTER_PROMPT;
    if (mode === 'moderation_only') {
      promptToUse = MODERATION_PROMPT
        .replace(/{{FINAL_TITLE}}/g, String(formData.get('title') || ''))
        .replace(/{{FINAL_DESCRIPTION}}/g, String(formData.get('description') || ''));
    } else if (mode === 'suggest') promptToUse = SUGGEST_PROMPT;
    else if (mode === 'final_check') {
      promptToUse = FINAL_CHECK_PROMPT
        .replace(/{{FINAL_TITLE}}/g, String(formData.get('title') || ''))
        .replace(/{{FINAL_DESCRIPTION}}/g, String(formData.get('description') || ''));
    }

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
              .replace(/{{START_PHRASE}}/g, startPhrase)
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

    // suggest mode never renders a moderation verdict — just the auto-fill suggestion.
    if (mode === 'suggest') {
      return new Response(JSON.stringify({
        is_safe: true,
        title: result.title,
        description: result.description,
        category: result.category,
        forensic: result.forensic
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // If unsafe, return immediately
    if (!result.is_safe) {
       return new Response(JSON.stringify({ is_safe: false, reason: result.reason }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // moderation_only and final_check are pure accept/reject decisions — no auto-fill payload,
    // but DO include is_document + privacy_regions so the client can offer the privacy-blur
    // tool pre-filled with AI suggestions, without a separate AI call (piggybacks on this
    // moderation pass, zero extra latency). Regions are sanitized here so a malformed model
    // response can't crash the client's canvas math.
    if (mode === 'moderation_only' || mode === 'final_check') {
      const privacyRegions = Array.isArray(result.privacy_regions)
        ? result.privacy_regions
            .filter((r: any) =>
              typeof r?.x === "number" && typeof r?.y === "number" &&
              typeof r?.width === "number" && typeof r?.height === "number",
            )
            .map((r: any) => {
              const x = Math.max(0, Math.min(1, r.x));
              const y = Math.max(0, Math.min(1, r.y));
              return {
                label: typeof r.label === "string" ? r.label : "sensitive",
                x,
                y,
                width: Math.max(0, Math.min(1 - x, r.width)),
                height: Math.max(0, Math.min(1 - y, r.height)),
              };
            })
        : [];
      const isDocument = !!result.is_document;
      return new Response(
        JSON.stringify({
          is_safe: true,
          is_document: isDocument,
          document_needs_id_proof: isDocument && !!result.document_needs_id_proof,
          privacy_regions: privacyRegions,
          redacted_title: typeof result.redacted_title === "string" ? result.redacted_title : String(formData.get('title') || ''),
          redacted_description: typeof result.redacted_description === "string" ? result.redacted_description : String(formData.get('description') || ''),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify({
      is_safe: true,
      title: result.title,
      description: result.description,
      category: result.category,
      forensic: result.forensic // Returning forensic keywords for background embedding
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error("AI Brain Error:", error.message);
    return new Response(JSON.stringify({ error: error.message, is_safe: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
