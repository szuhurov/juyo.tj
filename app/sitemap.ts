/**
 * Ин файл барои тавлиди худкори харитаи сайт (sitemap.xml) хидмат мекунад.
 * Харитаи сайт ба ботҳои ҷустуҷӯӣ барои пайдо кардани тамоми саҳифаҳои муҳим кӯмак мекунад.
 */
import { MetadataRoute } from 'next' // Инаш ҳам барои Next.js
 
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://juyo.tj'
  
  // Таърифи роҳҳои статикии сайт
  const routes = [
    '',
    '/privacy',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1 : 0.8,
  }))
 
  /**
   * Баргардонидани рӯйхати пурраи URL-ҳо.
   * Дар оянда метавон роҳҳои динамикиро (масалан, эълонҳо) аз махзани маълумот илова кард.
   */
  return [
    ...routes,
  ]
}
