import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'JUYO — Lost & Found Tajikistan';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #09090b 0%, #18181b 50%, #09090b 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 32,
          fontFamily: 'sans-serif',
        }}
      >
        {/* Logo text */}
        <div
          style={{
            fontSize: 120,
            fontWeight: 900,
            color: '#ffffff',
            letterSpacing: '-6px',
            lineHeight: 1,
          }}
        >
          JUYO
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 28,
            color: '#a1a1aa',
            fontWeight: 600,
            letterSpacing: '2px',
            textTransform: 'uppercase',
          }}
        >
          Гумшуда · Ёфтшуда · Тоҷикистон
        </div>

        {/* Divider */}
        <div
          style={{
            width: 80,
            height: 4,
            background: 'linear-gradient(90deg, #22c55e, #16a34a)',
            borderRadius: 2,
          }}
        />

        {/* URL */}
        <div
          style={{
            fontSize: 22,
            color: '#52525b',
            fontWeight: 500,
            letterSpacing: '1px',
          }}
        >
          juyo.tj
        </div>
      </div>
    ),
    { ...size }
  );
}
