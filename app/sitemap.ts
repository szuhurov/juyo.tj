import { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

/**
 * This file serves to automatically generate the sitemap (sitemap.xml).
 * We need to add both static pages and dynamic posts to it.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://juyo.tj'
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // 1. Static site routes (only general and important pages)
  const staticRoutes = [
    '',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 1,
  }))

  // If the keys are missing (e.g. during Build), return only the static routes
  if (!supabaseUrl || !supabaseKey) {
    return staticRoutes;
  }
  
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 2. Fetch the IDs of all approved posts from the database
    const { data: items } = await supabase
      .from('items')
      .select('id, updated_at')
      .eq('moderation_status', 'approved')
      .or('is_resolved.eq.false,is_resolved.is.null');

    // 3. Build URLs for each post
    const itemUrls = (items || []).map((item) => ({
      url: `${baseUrl}/items/${item.id}`,
      lastModified: new Date(item.updated_at || new Date()),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));

    return [
      ...staticRoutes,
      ...itemUrls,
    ];
  } catch (error) {
    console.error("Error generating sitemap:", error);
    return staticRoutes;
  }
}
