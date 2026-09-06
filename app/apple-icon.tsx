import { ImageResponse } from 'next/og'

/** Home-screen icon on iOS, which ignores the 32px favicon. */

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#020617',
          color: '#22d3ee',
          fontSize: 110,
          fontWeight: 700,
        }}
      >
        N
      </div>
    ),
    size
  )
}
