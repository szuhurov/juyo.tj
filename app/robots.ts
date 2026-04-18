/**
 * Танзимоти файли robots.txt барои муайян кардани дастрасии ботҳои ҷустуҷӯӣ.
 * Ин файл қоидаҳои индексатсияро барои беҳтар кардани SEO муайян мекунад.
 */
import { MetadataRoute } from 'next' // Барои Next.js лозим аст
 
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Маҳдуд кардани дастрасӣ ба саҳифаҳои шахсӣ ва хидматӣ
      disallow: ['/profile', '/sign-in', '/sign-up', '/qr/'],
    },
    // Истинод ба харитаи сайт барои индексатсияи беҳтар
    sitemap: 'https://juyo.tj/sitemap.xml',
  }
}
