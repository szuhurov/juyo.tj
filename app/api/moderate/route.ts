import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

async function moderateImage(url: string, apiUser: string, apiSecret: string) {
  try {
    const res = await fetch(
      `https://api.sightengine.com/1.0/check.json?url=${encodeURIComponent(url)}&models=nudity-2.0,wad,offensive&api_user=${apiUser}&api_secret=${apiSecret}`
    );
    const data = await res.json();
    
    if (data.status !== 'success') {
      console.error(`Sightengine error for ${url}:`, data.error?.message);
      return { isSafe: true, reason: null, error: data.error?.message };
    }

    let isSafe = true;
    let reason = null;

    if (data.nudity && (data.nudity.sexual_activity > 0.1 || data.nudity.sexual_display > 0.1 || data.nudity.erotica > 0.1)) {
      isSafe = false;
      reason = 'Inappropriate content (nudity)';
    } else if (data.weapon > 0.2) {
      isSafe = false;
      reason = 'Inappropriate content (weapons)';
    } else if (data.drugs > 0.2) {
      isSafe = false;
      reason = 'Inappropriate content (drugs)';
    } else if (data.offensive?.prob > 0.5) {
      isSafe = false;
      reason = 'Offensive content';
    }

    return { isSafe, reason };
  } catch (error: any) {
    console.error(`Fetch error for ${url}:`, error);
    return { isSafe: true, reason: null, error: error.message }; 
  }
}

export async function POST(request: Request) {
  let itemId: string | null = null;
  
  try {
    const body = await request.json();
    itemId = body.itemId;
    let images = body.imageUrls;

    // Fix for potential string/array mismatch
    if (typeof images === 'string') {
      images = [images];
    }

    if (!images || !Array.isArray(images) || images.length === 0 || !itemId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const apiUser = process.env.SIGHTENGINE_API_USER;
    const apiSecret = process.env.SIGHTENGINE_API_SECRET;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!apiUser || !apiSecret || !supabaseUrl || !supabaseKey) {
      throw new Error('Configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const results = await Promise.all(images.map(url => moderateImage(url, apiUser, apiSecret)));

    const unsafeResult = results.find(r => !r.isSafe);
    const finalStatus = unsafeResult ? 'rejected' : 'approved';
    const finalReason = unsafeResult ? unsafeResult.reason : null;

    const { error: updateError } = await supabase
      .from('items')
      .update({ 
        moderation_status: finalStatus,
        moderation_result: finalReason
      })
      .eq('id', itemId);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, status: finalStatus, reason: finalReason });

  } catch (error: any) {
    console.error('Moderation API Error:', error);
    
    if (itemId) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      await supabase
        .from('items')
        .update({ 
          moderation_status: 'approved',
          moderation_result: `System error during check: ${error.message}` 
        })
        .eq('id', itemId);
    }

    return NextResponse.json({ error: 'Internal error', details: error.message }, { status: 500 });
  }
}
