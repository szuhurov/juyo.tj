/**
 * Ин файл барои тавлиди худкори харитаи сайт (sitemap.xml) хидмат мекунад.
 * Харитаи сайт ба ботҳои ҷустуҷӯӣ барои пайдо кардани тамоми саҳифаҳои муҳим кӯмак мекунад.
 */
import { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

/**
 * Ин файл барои тавлиди худкори харитаи сайт (sitemap.xml) хидмат мекунад.
 * Мо бояд ҳам саҳифаҳои статикӣ ва ҳам эълонҳои динамикиро ба он илова кунем.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://juyo.tj'
  
  // Пайвастшавӣ ба Supabase (бевосита дар ин ҷо барои суръат)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // 1. Гирифтани ID-и ҳамаи эълонҳои тасдиқшуда аз база
  const { data: items } = await supabase
    .from('items')
    .select('id, updated_at')
    .eq('moderation_status', 'approved')
    .eq('is_resolved', false)

  // 2. Сохтани URL-ҳо барои ҳар як эълон
  const itemUrls = (items || []).map((item) => ({
    url: `${baseUrl}/items/${item.id}`,
    lastModified: new Date(item.updated_at || new Date()),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))

  // 3. Роҳҳои статикии сайт
  const staticRoutes = [
    '',
    '/profile',
    '/scan',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1 : 0.8,
  }))
 
  return [
    ...staticRoutes,
    ...itemUrls,
  ]
}
