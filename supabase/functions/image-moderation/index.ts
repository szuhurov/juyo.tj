import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SIGHTENGINE_API_USER = Deno.env.get('SIGHTENGINE_API_USER')
const SIGHTENGINE_API_SECRET = Deno.env.get('SIGHTENGINE_API_SECRET')
const SIGHTENGINE_LIST_ID = Deno.env.get('SIGHTENGINE_LIST_ID')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

Deno.serve(async (req) => {
  let itemId = null;
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  try {
    const payload = await req.json()
    const { record } = payload 
    itemId = record.id

    if (record.moderation_status !== 'pending') return new Response("OK", { status: 200 })

    // Таъхири кӯтоҳ барои итминони комил аз мавҷудияти файлҳо дар Storage
    await new Promise(resolve => setTimeout(resolve, 2500))

    const { data: images } = await supabase.from('item_images').select('id, image_url').eq('item_id', itemId)
    
    if (!images || images.length === 0) {
      await supabase.from('items').update({ moderation_status: 'approved' }).eq('id', itemId)
      return new Response("No images", { status: 200 })
    }

    let isSafe = true;
    let rejectionKey = null;

    // PROFESSIONAL MODELS SPECTRUM
    // nudity-2.1: Пешрафтатарин модели шинохтани бараҳнагӣ
    // gore-2.0: Модели нави шинохтани хунрезӣ ва ҷароҳатҳо
    // wad: Силоҳ, машрубот, маводи мухаддир
    // violence: Зӯроварии ҷисмонӣ ва таҳдидҳо
    // self-harm: Худкушӣ ва худзанонӣ
    // medical: Доруворӣ ва сӯзандоруҳо
    // recreational_drug: Маводи мухаддири фароғатӣ (ба мисли каннабис)
    // tobacco: Тамоку ва вейпҳо
    // gambling: Қиморбозӣ
    // money: Банкнотҳо ва асъор
    // offensive: Рамзҳои нафрат ва таҳқир
    // text: Шинохтани матнҳои қабеҳ
    // qr-content: Модератсияи мундариҷаи QR-кодҳо
    const models = "nudity-2.1,weapon,alcohol,recreational_drug,medical,gore-2.0,text,qr-content,tobacco,violence,self-harm,money,gambling,offensive,destruction,military"

    for (const img of images) {
      const params = new URLSearchParams({
        'url': img.image_url,
        'models': models,
        'api_user': SIGHTENGINE_API_USER!,
        'api_secret': SIGHTENGINE_API_SECRET!
      })

      const seRes = await fetch(`https://api.sightengine.com/1.0/check.json?${params.toString()}`);
      const seData = await seRes.json();

      if (seData.status === 'success') {
        // --- 1. NUDITY & SEXUAL CONTENT (EXTREMELY STRICT: 1%) ---
        const n = seData.nudity;
        if (n) {
          const sexualContent = n.sexual_activity > 0.01 || n.sexual_display > 0.01 || n.erotica > 0.01 || n.very_suggestive > 0.01 || n.suggestive > 0.01;
          const suggestiveClasses = n.visibly_undressed > 0.01 || n.sextoy > 0.01 || n.suggestive_focus > 0.01 || n.suggestive_pose > 0.01 || (n.lingerie_categories?.lingerie > 0.01) || (n.cleavage_categories?.very_revealing > 0.01);
          
          if (sexualContent || suggestiveClasses) {
            isSafe = false; rejectionKey = 'mod_nudity'; break;
          }
        }

        // --- 2. VIOLENCE & PHYSICAL FIGHTS (EXTREMELY STRICT: 1%) ---
        const v = seData.violence;
        if (v && (v.prob > 0.01 || (v.classes && (v.classes.physical_violence > 0.01 || v.classes.firearm_threat > 0.01)))) {
          isSafe = false; rejectionKey = 'mod_gore'; break;
        }

        // --- 3. GORE, BLOOD & CORPSES (EXTREMELY STRICT: 1%) ---
        const g = seData.gore;
        if (g && (g.prob > 0.01 || (g.classes && (g.classes.very_bloody > 0.01 || g.classes.body_organ > 0.01 || g.classes.corpse > 0.01 || g.classes.serious_injury > 0.01)))) {
          isSafe = false; rejectionKey = 'mod_gore'; break;
        }

        // --- 4. WEAPONS & FIREARMS (EXTREMELY STRICT: 1%) ---
        const w = seData.weapon;
        if (w && (w.classes && (w.classes.firearm > 0.01 || w.classes.knife > 0.01 || w.classes.firearm_gesture > 0.01 || w.classes.firearm_toy > 0.05))) {
          isSafe = false; rejectionKey = 'mod_weapon'; break;
        }

        // --- 5. DRUGS & MEDICAL (ACAGOL, PILLS, CANNABIS) (EXTREMELY STRICT: 1%) ---
        const rd = seData.recreational_drug;
        const med = seData.medical;
        if ((rd && rd.prob > 0.01) || (med && (med.pills > 0.01 || med.paraphernalia > 0.01))) {
          isSafe = false; rejectionKey = 'mod_drugs'; break;
        }

        // --- 6. SELF-HARM & SUICIDE (ZERO TOLERANCE: 1%) ---
        const sh = seData.self_harm;
        if (sh && (sh.prob > 0.01 || (sh.type && (sh.type.real > 0.01 || sh.type.animated > 0.01)))) {
          isSafe = false; rejectionKey = 'mod_gore'; break;
        }

        // --- 7. TOBACCO & ALCOHOL (STRICT: 5%) ---
        const tobacco = seData.tobacco;
        const alcohol = seData.alcohol;
        if ((tobacco && tobacco.prob > 0.05) || (alcohol && alcohol.prob > 0.05)) {
          rejectionKey = (tobacco && tobacco.prob > 0.05) ? 'mod_tobacco' : 'mod_alcohol';
          isSafe = false; break;
        }

        // --- 8. OFFENSIVE, HATE & SYMBOLS (STRICT: 1%) ---
        const off = seData.offensive;
        if (off && off.prob > 0.01) {
          isSafe = false; rejectionKey = 'mod_offensive'; break;
        }

        // --- 9. GAMBLING & SCAM (STRICT: 10%) ---
        const gambling = seData.gambling;
        if (gambling && gambling.prob > 0.1) {
          isSafe = false; rejectionKey = 'mod_scam'; break;
        }

        // --- 10. TEXT & QR MODERATION (OCR) ---
        const txt = seData.text;
        const qr = seData.qr;
        if ((txt && txt.profanity?.length > 0) || (qr && qr.profanity?.length > 0)) {
          isSafe = false; rejectionKey = 'mod_offensive_text'; break;
        }
      }

      if (!isSafe) break;
    }

    const finalStatus = isSafe ? 'approved' : 'rejected'
    
    // Автоматикӣ илова кардани аксҳои тасдиқшуда ба рӯйхати сафеди Sightengine
    if (finalStatus === 'approved' && SIGHTENGINE_LIST_ID) {
      for (const img of images) {
        fetch("https://api.sightengine.com/1.0/check.json", {
          method: 'POST',
          body: new URLSearchParams({ 
            'api_user': SIGHTENGINE_API_USER!, 
            'api_secret': SIGHTENGINE_API_SECRET!, 
            'url': img.image_url, 
            'add_to_list': SIGHTENGINE_LIST_ID, 
            'custom_id': img.id 
          })
        });
      }
    }

    // Навсозии ҳолати эълон дар базаи маълумоти Supabase
    await supabase.from('items').update({ 
      moderation_status: finalStatus, 
      moderation_result: rejectionKey, 
      updated_at: new Date().toISOString() 
    }).eq('id', itemId)

    return new Response(JSON.stringify({ success: true, status: finalStatus }), { status: 200 })

  } catch (error: any) {
    console.error("Professional Moderation Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
