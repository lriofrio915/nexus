import { ImageResponse } from 'next/og'
import { siteConfig } from '@/lib/site-config'

/**
 * The card WhatsApp, LinkedIn and X render when the site is shared.
 *
 * Drawn rather than shipped as a file so the copy stays in sync with
 * site-config and there is no binary to keep updated. Rendered at build time
 * for this static route, so it costs nothing per share.
 */

export const alt = `${siteConfig.name} — ${siteConfig.tagline}`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#020617',
          padding: 80,
          // The cyan wash echoes the site's own background glow.
          backgroundImage:
            'radial-gradient(900px 500px at 80% 0%, rgba(34,211,238,0.18), transparent 60%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: '#22d3ee',
              color: '#020617',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 34,
              fontWeight: 700,
            }}
          >
            N
          </div>
          <div style={{ color: 'white', fontSize: 34, fontWeight: 700, letterSpacing: 6 }}>
            NEXUS
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ color: 'white', fontSize: 68, fontWeight: 700, lineHeight: 1.1 }}>
            {siteConfig.tagline}
          </div>
          <div style={{ color: '#94a3b8', fontSize: 32, lineHeight: 1.35 }}>
            Sistemas de gestión médica, trading cuantitativo y automatización con IA.
          </div>
        </div>

        <div style={{ color: '#22d3ee', fontSize: 28 }}>
          {siteConfig.url.replace('https://', '')}
        </div>
      </div>
    ),
    size
  )
}
