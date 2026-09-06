import { ImageResponse } from 'next/og'

/**
 * The onboarding link is sent to clients one by one over WhatsApp, so its
 * preview has to say what the form is before anyone taps it.
 */

export const alt = 'Apertura de cuenta en Interactive Brokers con Nexus'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OnboardingOpengraphImage() {
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
          backgroundImage:
            'radial-gradient(900px 500px at 20% 100%, rgba(34,211,238,0.18), transparent 60%)',
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
          <div style={{ color: '#22d3ee', fontSize: 30, letterSpacing: 4 }}>
            APERTURA DE CUENTA
          </div>
          <div style={{ color: 'white', fontSize: 64, fontWeight: 700, lineHeight: 1.1 }}>
            Tu cuenta de inversión en Interactive Brokers
          </div>
          <div style={{ color: '#94a3b8', fontSize: 30, lineHeight: 1.35 }}>
            Completa el formulario y nosotros hacemos el trámite.
          </div>
        </div>

        <div style={{ color: '#64748b', fontSize: 26 }}>
          Toma unos minutos · Tus datos viajan cifrados
        </div>
      </div>
    ),
    size
  )
}
