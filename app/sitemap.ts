import { MetadataRoute } from 'next'
 
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://juyo.tj'
  
  // Static routes
  const routes = [
    '',
    '/privacy',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1 : 0.8,
  }))
 
  return [
    ...routes,
    // In a real production app, you would fetch all item IDs from Supabase here
    // and add them to the sitemap dynamically.
  ]
}
