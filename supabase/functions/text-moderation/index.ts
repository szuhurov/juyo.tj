import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  try {
    const { record, lang } = await req.json();
    const { id, title, description, moderation_status } = record;

    // Skip if already moderated (e.g. by AI Brain in the UI)
    if (moderation_status !== "pending") {
      return new Response("Already moderated, skipping", { status: 200 });
    }

    const langMap: Record<string, string> = {
      tg: "Tajik",
      ru: "Russian",
      en: "English",
    };
    const targetLang = langMap[lang as string] || "Tajik";

    const textToCheck = `${title} ${description || ""}`;

    // Санҷиши матн бо модели OpenAI
    const aiResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-5.5",
          reasoning_effort: "medium",
          messages: [
            {
              role: "system",
              content: `You are a sophisticated Security & Content Analyst for JUYO.tj.
            Analyze the CONTEXT and INTENT of the text in Tajik, Russian, or English.
            
            STRICTLY PROHIBIT (is_safe: false):
            1. PROFANITY & HARASSMENT: Not just bad words, but any intent to insult, degrade, or bully others.
            2. ILLEGAL TRADE: Any attempt to buy, sell, or trade drugs, weapons, or items under police tracking.
            3. SCAMS & FRAUD: Intent to deceive users.
            4. HATE SPEECH: Racism, sexism, or any discrimination.
            
            ALLOW (is_safe: true):
            1. Contextual mentions (e.g., "This is not drugs" or "Found a kitchen knife" - if it's clearly a household item description).
            2. Normal human frustration that doesn't target individuals or use profanity.
            
            CRITICAL:
            - Your response 'reason' MUST BE IN ${targetLang}.
            - Identify the SPECIFIC PHRASE or SECTION of the text that triggered the rejection.
            - DO NOT TRANSLATE the problematic phrase; keep it EXACTLY as the user wrote it and wrap it in double quotes (e.g., "original text").
            - Explain WHY that specific part is problematic in ${targetLang}.
            - Your goal is to help the user understand exactly what to change while maintaining a professional and firm tone.
            
            Return JSON: { 'is_safe': boolean, 'reason': "Detailed explanation in ${targetLang} with the original problematic part in quotes" }`,
            },
            { role: "user", content: textToCheck },
          ],
          response_format: { type: "json_object" },
        }),
      },
    );

    const aiData = await aiResponse.json();
    if (aiData.error) throw new Error(aiData.error.message);
    const result = JSON.parse(aiData.choices[0].message.content);

    if (!result.is_safe) {
      await supabase
        .from("items")
        .update({
          moderation_status: "rejected",
          moderation_result: result.reason,
        })
        .eq("id", id);
      return new Response(
        JSON.stringify({ is_safe: false, reason: result.reason }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    return new Response(JSON.stringify({ is_safe: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Text Moderation Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
