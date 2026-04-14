import { ImageResponse } from 'next/og'

export const size = {
  width: 30,
  height: 30,
}
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 25, 
          background: 'black',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          borderRadius: '22%', // Elegant squircle
          fontWeight: 900,
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
         
          padding: 0,
          margin: 0,
         
        }}
      >
        J
      </div>
    ),
    {
      ...size,
    }
  )
}
