import { siteConfig, servicios, especialidades } from '@/lib/site-config'

/**
 * structured-data.ts — JSON-LD for the landing page.
 *
 * Built from site-config so the copy search engines read is the same copy the
 * page renders; a service added to the site shows up here without a second
 * edit. Emitted by app/page.tsx.
 */

const ORGANIZATION_ID = `${siteConfig.url}/#organization`
const WEBSITE_ID = `${siteConfig.url}/#website`

export function structuredData() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ProfessionalService',
        '@id': ORGANIZATION_ID,
        name: siteConfig.legalName,
        alternateName: siteConfig.name,
        url: siteConfig.url,
        description: siteConfig.description,
        slogan: siteConfig.tagline,
        image: `${siteConfig.url}/opengraph-image`,
        logo: `${siteConfig.url}/icon`,
        telephone: `+${siteConfig.whatsappNumber}`,
        // The studio works remotely, so the area served is what matters rather
        // than a street address Google would ask to verify.
        areaServed: [
          { '@type': 'Country', name: 'Ecuador' },
          { '@type': 'Place', name: 'Latinoamérica' },
        ],
        address: { '@type': 'PostalAddress', addressCountry: 'EC' },
        knowsAbout: especialidades.map((e) => e.title),
        sameAs: [siteConfig.whatsappUrl],
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: 'Servicios de Nexus',
          itemListElement: servicios.map((servicio) => ({
            '@type': 'Offer',
            itemOffered: {
              '@type': 'Service',
              name: servicio.title,
              description: servicio.description,
              provider: { '@id': ORGANIZATION_ID },
            },
          })),
        },
      },
      {
        '@type': 'WebSite',
        '@id': WEBSITE_ID,
        url: siteConfig.url,
        name: siteConfig.name,
        description: siteConfig.description,
        inLanguage: 'es-EC',
        publisher: { '@id': ORGANIZATION_ID },
      },
    ],
  }
}

/**
 * Serialised for a <script> tag. `<` is escaped because JSON.stringify does not
 * sanitise it and the payload lands inside HTML.
 */
export function structuredDataJson(): string {
  return JSON.stringify(structuredData()).replace(/</g, '\\u003c')
}
