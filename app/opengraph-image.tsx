import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
// Nunito, like the rest of the site (font files are in app/fonts).
const loadFont = (file: string) => readFile(join(process.cwd(), 'app', 'fonts', file));

export const alt = 'JUYO — Lost & Found Tajikistan';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OGImage() {
  const [bold, semiBold] = await Promise.all([loadFont('Nunito-Bold.ttf'), loadFont('Nunito-SemiBold.ttf')]);
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
          fontFamily: 'Nunito',
        }}
      >
        {/* Logo text */}
        <div
          style={{
            fontSize: 120,
            fontWeight: 700,
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
            fontWeight: 600,
            letterSpacing: '1px',
          }}
        >
          juyo.tj
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Nunito', data: bold, weight: 700, style: 'normal' },
        { name: 'Nunito', data: semiBold, weight: 600, style: 'normal' },
      ],
    }
  );
}
