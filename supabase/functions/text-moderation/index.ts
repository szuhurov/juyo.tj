import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
  
  try {
    const { record } = await req.json();
    const { id, title, description, moderation_status } = record;

    // Skip if already moderated (e.g. by AI Brain in the UI)
    if (moderation_status !== 'pending') {
      return new Response("Already moderated, skipping", { status: 200 });
    }

    const textToCheck = `${title} ${description || ''}`;

    // Санҷиши матн бо модели OpenAI
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a content moderator for a Tajik 'Lost and Found' app. Check the text for profanity, hate speech, or illegal content in Tajik, Russian, or English. Return JSON: { 'is_safe': boolean, 'reason': string or null }"
          },
          { role: "user", content: textToCheck }
        ],
        response_format: { type: "json_object" }
      }),
    });

    const aiData = await aiResponse.json();
    if (aiData.error) throw new Error(aiData.error.message);
    const result = JSON.parse(aiData.choices[0].message.content);

    if (!result.is_safe) {
      await supabase.from('items').update({ 
        moderation_status: 'rejected',
        moderation_result: result.reason 
      }).eq('id', id);
      return new Response(JSON.stringify({ is_safe: false, reason: result.reason }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      });
    }

    return new Response(JSON.stringify({ is_safe: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    });

  } catch (error: any) {
    console.error("Text Moderation Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500 
    });
  }
});
