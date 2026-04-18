import { MetadataRoute } from 'next'
 
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/profile', '/sign-in', '/sign-up', '/qr/'],
    },
    sitemap: 'https://juyo.tj/sitemap.xml',
  }
}
