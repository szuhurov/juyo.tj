/**
 * robots.txt configuration for defining search bot access.
 * This file defines the indexing rules to improve SEO.
 */
import { MetadataRoute } from 'next' // Required for Next.js

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Restrict access to personal and service pages
      disallow: ['/profile', '/sign-in', '/sign-up', '/qr/'],
    },
    // Reference to the sitemap for better indexing
    sitemap: 'https://juyo.tj/sitemap.xml',
  }
}
