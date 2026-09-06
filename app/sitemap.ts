import type { MetadataRoute } from 'next'
import { siteConfig } from '@/lib/site-config'

/**
 * Only the landing page is indexable. The panel is behind a password and the
 * onboarding form is shared by link, so neither belongs here.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteConfig.url,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
  ]
}
