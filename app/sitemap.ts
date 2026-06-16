import { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

/**
 * Ин файл барои тавлиди худкори харитаи сайт (sitemap.xml) хидмат мекунад.
 * Мо бояд ҳам саҳифаҳои статикӣ ва ҳам эълонҳои динамикиро ба он илова кунем.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://juyo.tj'
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // 1. Роҳҳои статикии сайт (Танҳо саҳифаҳои умумӣ ва муҳим)
  const staticRoutes = [
    '',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 1,
  }))

  // Агар калидҳо набошанд (масалан ҳангоми Build), танҳо роҳҳои статикиро бармегардонем
  if (!supabaseUrl || !supabaseKey) {
    return staticRoutes;
  }
  
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 2. Гирифтани ID-и ҳамаи эълонҳои тасдиқшуда аз база
    const { data: items } = await supabase
      .from('items')
      .select('id, updated_at')
      .eq('moderation_status', 'approved')
      .or('is_resolved.eq.false,is_resolved.is.null');

    // 3. Сохтани URL-ҳо барои ҳар як эълон
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
