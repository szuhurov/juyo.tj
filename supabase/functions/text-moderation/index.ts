import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

Deno.serve(async (req) => {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
  
  try {
    const { record } = await req.json();
    const { id, title, description } = record;
    const textToCheck = `${title} ${description || ''}`;

    // Санҷиши матн бо модели флагмании GPT-5.5
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.5",
        messages: [
          {
            role: "system",
            content: "You are a content moderator for a Tajik 'Lost and Found' app. Check the text for profanity, hate speech, or illegal content in Tajik, Russian, or English. Return JSON: { 'is_safe': boolean, 'reason': string or null }"
            ... rest of context...


    const aiData = await aiResponse.json();
    const result = JSON.parse(aiData.choices[0].message.content);

    if (!result.is_safe) {
      await supabase.from('items').update({ 
        moderation_status: 'rejected',
        moderation_result: result.reason 
      }).eq('id', id);
      return new Response(`Rejected: ${result.reason}`, { status: 200 });
    }

    return new Response("Text OK", { status: 200 });

  } catch (error: any) {
    console.error("Text Moderation Error:", error.message);
    return new Response(error.message, { status: 500 });
  }
});
