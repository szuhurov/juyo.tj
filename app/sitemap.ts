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
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // 1. Роҳҳои статикии сайт
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

  // Агар калидҳо набошанд, танҳо роҳҳои статикиро бармегардонем
  if (!supabaseUrl || !supabaseKey) {
    console.warn("Supabase keys missing during sitemap generation. Returning static routes only.");
    return staticRoutes;
  }
  
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    // ... rest of the dynamic logic
