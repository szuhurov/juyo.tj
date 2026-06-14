import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const type = formData.get('type') as string;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const category = formData.get('category') as string;
    const phone = formData.get('phone') as string;
    const reward = formData.get('reward') as string | null;
    const forensicText = formData.get('forensic_text') as string | null;
    const images = formData.getAll('image') as File[];

    if (!type || !title || !description || !category || !phone) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Upload images to storage
    const imageUrls: string[] = [];
    for (const image of images) {
      const arrayBuffer = await image.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const ext = image.name.split('.').pop() || 'jpg';
      const fileName = `guest-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('items')
        .upload(fileName, buffer, { contentType: image.type });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('items').getPublicUrl(fileName);
      imageUrls.push(publicUrl);
    }

    // 6 months expiry
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 6);

    const { data: item, error: itemError } = await supabase
      .from('items')
      .insert([{
        user_id: null,
        is_guest: true,
        expires_at: expiresAt.toISOString(),
        title,
        description,
        category,
        type,
        phone_number: phone,
        reward: type === 'lost' && reward ? reward : null,
        date: new Date().toISOString().split('T')[0],
        is_resolved: false,
        moderation_status: 'approved',
      }])
      .select()
      .single();

    if (itemError) throw itemError;

    if (imageUrls.length > 0) {
      await supabase.from('item_images').insert(
        imageUrls.map(url => ({ item_id: item.id, image_url: url, embedding: null }))
      );
    }

    // Generate embedding in background
    supabase.functions.invoke('generate-embedding', {
      body: { item_id: item.id, text: forensicText || `${title} ${description}` }
    }).catch(err => console.error('Guest embedding failed:', err));

    return NextResponse.json({ success: true, itemId: item.id });
  } catch (error: any) {
    console.error('Guest post error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
