import type { MetadataRoute } from 'next'
import { siteConfig } from '@/lib/site-config'

/**
 * The public site is one page; everything else is either the panel or a form
 * meant to be handed out by link, so crawlers are kept out of both. The pages
 * themselves also carry `robots: { index: false }`, which is what actually
 * binds -- this file only saves the crawl.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/panel', '/panel/', '/onboarding', '/onboarding/', '/api/'],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  }
}
