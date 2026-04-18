/**
 * Ин файл барои тавлиди динамикии нишонаи (favicon) барнома хидмат мекунад.
 * Бо истифода аз Next.js ImageResponse, як тасвири PNG бо ҳарфи "J" сохта мешавад.
 */
import { ImageResponse } from 'next/og' // Ин барои сохтани тасвирҳои зӯр

// Андозаҳои нишона
export const size = {
  width: 30,
  height: 30,
}
export const contentType = 'image/png'

/**
 * Компоненти асосӣ барои тавлиди тасвири нишона.
 * Услуби "squircle" ва рангҳои сиёҳу сафедро истифода мебарад.
 */
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
          borderRadius: '22%', // Squircle-и шево
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
