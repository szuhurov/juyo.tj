import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SIGHTENGINE_API_USER = Deno.env.get('SIGHTENGINE_API_USER')
const SIGHTENGINE_API_SECRET = Deno.env.get('SIGHTENGINE_API_SECRET')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

// Рӯйхати калимаҳои мамнӯъи тоҷикӣ (Blacklist)
// Шумо метавонед инҷо калимаҳои навро илова кунед
const TAJIK_BLACKLIST = [
  // Latin
  "ker",
  "kir",
  "ks",
  "kus",
  "kun",
  "harom",
  "haram",
  "lanat",
  "lanati",
  "badbakht",

  // Cyrillic
  "кер",
  "кир",
  "кс",
  "кус",
  "кун",
  "харом",
  "ҳаром",
  "ланат",
  "ланати",
  "бадбахт",
  "лаънат",

  // Drugs & Medications (Extended Strict List)
  "nasha",
  "nasha-nasha",
  "taryok",
  "taryak",
  "geroin",
  "bang",
  "paxan",
  "doru",
  "nashvador",
  "kokain",
  "met",
  "kristall",
  "khokai safed",
  "khoka",
  "наша",
  "тарёк",
  "тарёқ",
  "героин",
  "банг",
  "дору",
  "кокаин",
  "мет",
  "кристалл",
  "хокаи сафед",
  "хока",
  "белый порошок",
  "порошок",
  "нарко",
  "наркотик",
  "трава",
  "план",
  "white powder",
  "powder",
  "drugs",
  "cocaine",
  "heroin",
  "meth"
];

// Функсия барои тоза кардани матн ва омодасозии он барои санҷиш
function normalizeText(text: string) {
  return text
    .toLowerCase()
    .replace(/[@4]/g, "a")
    .replace(/[1!|]/g, "i")
    // Мо аввал аломатҳои махсусро нест мекунем, вале фосилаҳоро мемонем барои "word boundary"
    .replace(/[^\p{L}\p{N}\s]/gu, "");
}

// Функсия барои ёфтани калимаи бад (танҳо агар ҳамчун калимаи алоҳида бошад)
function findBadWord(text: string) {
  const normalized = normalizeText(text);
  const wordsInText = normalized.split(/\s+/);
  
  for (const badWord of TAJIK_BLACKLIST) {
    const normBadWord = normalizeText(badWord);
    // Санҷиши калимаи пурра (standalone word)
    if (wordsInText.includes(normBadWord)) {
      return badWord;
    }
  }
  return null;
}

Deno.serve(async (req) => {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
  
  try {
    const { record } = await req.json();
    const { id, title, description } = record;
    const textToCheck = `${title} ${description}`;

    // 1. Санҷиши калимаҳои тоҷикӣ (Local Blacklist)
    const detectedWord = findBadWord(textToCheck);
    if (detectedWord) {
      await supabase.from('items').update({ 
        moderation_status: 'rejected',
        moderation_result: `mod_offensive_text:${detectedWord}` 
      }).eq('id', id);
      return new Response(`Rejected: contains ${detectedWord}`, { status: 200 });
    }

    // 2. Санҷиши Sightengine (барои Англисӣ ва Русӣ)
    const params = new URLSearchParams({
      'text': textToCheck.toLowerCase(),
      'lang': 'en,ru',
      'mode': 'standard',
      'categories': 'profanity,drugs,medical',
      'api_user': SIGHTENGINE_API_USER!,
      'api_secret': SIGHTENGINE_API_SECRET!
    });

    const response = await fetch(`https://api.sightengine.com/1.0/check-text.json?${params.toString()}`);
    const data = await response.json();

    if (data.status === 'success') {
      // Санҷиши ҳақорат (Profanity)
      if (data.profanity?.matches?.length > 0) {
        const word = data.profanity.matches[0].word;
        await supabase.from('items').update({ 
          moderation_status: 'rejected',
          moderation_result: `mod_offensive_text_profanity` 
        }).eq('id', id);
        return new Response("Rejected (Profanity)", { status: 200 });
      }

      // Санҷиши маводи мухаддир (Drugs)
      if (data.text?.detections?.drugs?.matches?.length > 0) {
        await supabase.from('items').update({ 
          moderation_status: 'rejected',
          moderation_result: `mod_drugs` 
        }).eq('id', id);
        return new Response("Rejected (Drugs)", { status: 200 });
      }

      // Санҷиши доруҳои хатарнок (Medical - High intensity only)
      const medicalMatches = data.text?.detections?.medical?.matches || [];
      const hasDangerousMeds = medicalMatches.some((m: any) => m.intensity === 'high');
      
      if (hasDangerousMeds) {
        await supabase.from('items').update({ 
          moderation_status: 'rejected',
          moderation_result: `mod_drugs` 
        }).eq('id', id);
        return new Response("Rejected (Medical)", { status: 200 });
      }
    }

    return new Response("Text OK", { status: 200 });

  } catch (error) {
    console.error(error);
    return new Response(error.message, { status: 500 });
  }
});
