"use client";

/**
 * Content of the Privacy Policy page — a Client Component, so switching the
 * language from the header (without navigation/reload) is reflected
 * instantly, like on all other pages. Metadata (title/description) is
 * handled in the parent page.tsx (a Server Component).
 */
import { useLanguage } from "@/lib/language-context";

const content = {
  tg: {
    title: "Сиёсати махфият",
    lastUpdated: "Навсозии охирин: 16 июни соли 2026",
    intro: "Мо ба махфияти шумо эҳтиром мегузорем. Ин ҳуҷҷат мефаҳмонад, ки кадом маълумотро мо ҷамъоварӣ мекунем ва чӣ гуна онро истифода мебарем. Ин сиёсат ба барномаи мобилии juyo (Android) ва сайти juyo.tj татбиқ мешавад.",
    sections: [
      {
        id: "data",
        title: "1. Ҷамъоварии маълумот",
        text: "Мо маълумоти зеринро ҷамъоварӣ мекунем: ном, насаб, рақами телефон ва суроғаи почтаи электронӣ ҳангоми бақайдгирӣ тавассути Clerk, Google ё Apple. Инчунин суратҳои эълонҳое, ки шумо бор мекунед."
      },
      {
        id: "camera",
        title: "2. Иҷозати камера",
        text: "Барномаи juyo барои скан кардани QR-кодҳо ба камераи дастгоҳ дастрасӣ мепурсад. Мо ягон сурат аз камераро бе иҷозати шумо нигоҳ намедорем. Скани QR танҳо дар дастгоҳи шумо амалӣ мешавад."
      },
      {
        id: "gallery",
        title: "3. Дастрасӣ ба галерея",
        text: "Барои гузоштани суратҳо дар эълонҳо, барнома иҷозати дастрасӣ ба галереяи телефонро мепурсад. Суратҳо танҳо бо иҷозати шумо ба серверҳои Supabase бор карда мешаванд."
      },
      {
        id: "usage",
        title: "4. Истифодаи маълумот",
        text: "Маълумоти шумо танҳо барои таъмини кори платформаи juyo, тасдиқи шахсият ва имконияти тамос бо соҳибони ашёҳои гумшуда истифода мешавад. Мо маълумоти шуморо ба шахсони сеюм намефурӯшем."
      },
      {
        id: "third-party",
        title: "5. Хидматҳои шахсони сеюм",
        text: "Мо аз хидматҳои зерин истифода мебарем: Clerk (аутентификатсия), Supabase (нигоҳдории маълумот), Vercel Analytics (омори истифодабарандагон). Ин хидматҳо сиёсати махфияти худро доранд."
      },
      {
        id: "retention",
        title: "6. Нигоҳдории маълумот",
        text: "Маълумоти шумо то вақте ки ҳисоби худро нест кунед нигоҳ дошта мешавад. Пас аз нест кардани ҳисоб, ҳамаи маълумоти шахсӣ дар муддати 30 рӯз пок карда мешавад."
      },
      {
        id: "rights",
        title: "7. Ҳуқуқҳои шумо",
        text: "Шумо метавонед дар ҳар вақт маълумоти худро дар танзимоти профил иваз кунед. Барои нест кардани ҳисоби худ — ҳатто бе воридшавӣ ба барнома — саҳифаи juyo.tj/delete-account-ро кушоед ё ба s.zuhurov@outlook.com нависед."
      },
      {
        id: "qr",
        title: "8. QR-код: сатҳҳо ва нарх",
        text: "QR-и «Оддӣ» ҳамеша БЕПУЛ аст — онро бе ҳеҷ маҳдудият боргирӣ мекунед. Сатҳҳои «Худсоз» ва «Pro» (ранг, шакл, матн ва градиенти худӣ) пулакӣ мешаванд; ба ҷои пардохт метавонед реклама бинед ва як бор боргирӣ кунед. Нархи дақиқ ҳангоми дастрас шудани пардохт дар ҳамин ҷо нишон дода мешавад. Рақами дуюм ва шабакаҳои иҷтимоӣ роҳи эҳтиётии тамосанд: агар телефони шумо гум шавад ё ҷавоб надиҳед, ёбанда аз он ҷо ба шумо мерасад — шабакаҳо ихтиёрианд. QR-и шумо танҳо ҳамон маълумотеро нишон медиҳад, ки худатон ворид кардаед, ва шумо метавонед онро дар ҳар лаҳза аз тумблери «Статуси QR-код» хомӯш кунед."
      }
    ]
  },
  ru: {
    title: "Политика конфиденциальности",
    lastUpdated: "Последнее обновление: 16 июня 2026 г.",
    intro: "Мы уважаем вашу конфиденциальность. Этот документ объясняет, какие данные мы собираем и как их используем. Данная политика применяется к мобильному приложению juyo (Android) и сайту juyo.tj.",
    sections: [
      {
        id: "data",
        title: "1. Сбор информации",
        text: "Мы собираем следующие данные: имя, фамилия, номер телефона и адрес электронной почты при регистрации через Clerk, Google или Apple. Также фотографии объявлений, которые вы загружаете."
      },
      {
        id: "camera",
        title: "2. Разрешение на камеру",
        text: "Приложение juyo запрашивает доступ к камере устройства для сканирования QR-кодов. Мы не сохраняем никаких снимков с камеры без вашего разрешения. Сканирование QR выполняется только на вашем устройстве."
      },
      {
        id: "gallery",
        title: "3. Доступ к галерее",
        text: "Для добавления фотографий к объявлениям приложение запрашивает доступ к галерее телефона. Фотографии загружаются на серверы Supabase только с вашего разрешения."
      },
      {
        id: "usage",
        title: "4. Использование данных",
        text: "Ваши данные используются исключительно для обеспечения работы платформы juyo, проверки личности и возможности связи с владельцами утерянных вещей. Мы не продаём ваши данные третьим лицам."
      },
      {
        id: "third-party",
        title: "5. Сторонние сервисы",
        text: "Мы используем следующие сервисы: Clerk (аутентификация), Supabase (хранение данных), Vercel Analytics (статистика пользователей). Эти сервисы имеют свою политику конфиденциальности."
      },
      {
        id: "retention",
        title: "6. Хранение данных",
        text: "Ваши данные хранятся до тех пор, пока вы не удалите свой аккаунт. После удаления аккаунта все личные данные удаляются в течение 30 дней."
      },
      {
        id: "rights",
        title: "7. Ваши права",
        text: "Вы можете в любое время изменить свои данные в настройках профиля. Чтобы удалить аккаунт — даже без входа в приложение — откройте juyo.tj/delete-account или напишите на s.zuhurov@outlook.com."
      },
      {
        id: "qr",
        title: "8. QR-код: уровни и цены",
        text: "QR «Простой» всегда БЕСПЛАТНЫЙ — скачивайте без ограничений. Уровни «Свой» и «Pro» (свой цвет, форма, текст и градиент) станут платными; вместо оплаты можно посмотреть рекламу и скачать один раз. Точная цена будет показана здесь же, когда оплата станет доступна. Второй номер и социальные сети — запасной способ связи: если ваш телефон потерян или вы не отвечаете, нашедший свяжется с вами там; социальные сети необязательны. Ваш QR показывает только те данные, которые вы сами ввели, и вы можете отключить его в любой момент переключателем «Статус QR-кода»."
      }
    ]
  },
  en: {
    title: "Privacy Policy",
    lastUpdated: "Last updated: June 16, 2026",
    intro: "We respect your privacy. This document explains what data we collect and how we use it. This policy applies to the juyo mobile app (Android) and the website juyo.tj.",
    sections: [
      {
        id: "data",
        title: "1. Data Collection",
        text: "We collect the following data: first name, last name, phone number, and email address when registering via Clerk, Google, or Apple. Also photos of listings that you upload."
      },
      {
        id: "camera",
        title: "2. Camera Permission",
        text: "The juyo app requests access to the device camera to scan QR codes. We do not store any photos from the camera without your permission. QR scanning is performed only on your device."
      },
      {
        id: "gallery",
        title: "3. Gallery Access",
        text: "To add photos to listings, the app requests access to the phone gallery. Photos are uploaded to Supabase servers only with your permission."
      },
      {
        id: "usage",
        title: "4. Use of Data",
        text: "Your data is used solely to ensure the operation of the juyo platform, verify identity, and enable contact with owners of lost items. We do not sell your data to third parties."
      },
      {
        id: "third-party",
        title: "5. Third-party Services",
        text: "We use the following services: Clerk (authentication), Supabase (data storage), Vercel Analytics (user statistics). These services have their own privacy policies."
      },
      {
        id: "retention",
        title: "6. Data Retention",
        text: "Your data is retained until you delete your account. After account deletion, all personal data is erased within 30 days."
      },
      {
        id: "rights",
        title: "7. Your Rights",
        text: "You can change your data in profile settings at any time. To delete your account — even without signing into the app — visit juyo.tj/delete-account or email s.zuhurov@outlook.com."
      },
      {
        id: "qr",
        title: "8. QR code: tiers and pricing",
        text: "The Basic QR is always FREE — download it without limits. The Custom and Pro tiers (your own colour, shape, text and gradient) will be paid; instead of paying you can watch an ad and download once. The exact price will be shown here once payment is available. The second number and social networks are a backup route: if your phone is lost or you do not answer, the finder can still reach you there — social networks are optional. Your QR shows only the data you entered yourself, and you can switch it off at any time with the QR status toggle."
      }
    ]
  }
} satisfies Record<string, { title: string; lastUpdated: string; intro: string; sections: { id: string; title: string; text: string }[] }>;

export function PrivacyContent() {
  const { locale } = useLanguage();
  const currentContent = content[locale as keyof typeof content] || content.en;

  return (
    <div className="max-w-3xl mx-auto my-6 px-4 sm:px-8 py-10 rounded-md bg-white dark:bg-zinc-800 border border-hairline dark:border-zinc-700">
      <h1 className="text-3xl font-bold mb-4">{currentContent.title}</h1>
      <p className="text-sm text-slate-500 mb-8">{currentContent.lastUpdated}</p>

      <p className="mb-8 text-lg text-zinc-700 dark:text-zinc-300">
        {currentContent.intro}
      </p>

      <div className="space-y-8">
        {currentContent.sections.map((section) => (
          // `scroll-mt-24` — the fixed top bar would otherwise cover the
          // section heading and the `#anchor` link would land on empty space.
          <div key={section.id} id={section.id} className="scroll-mt-24">
            <h2 className="text-xl font-semibold mb-3">{section.title}</h2>
            <p className="text-slate-600 dark:text-zinc-400 leading-relaxed">
              {section.text}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-12 pt-8 border-t border-hairline dark:border-zinc-700 text-sm text-slate-500">
        <p>Email: s.zuhurov@outlook.com</p>
      </div>
    </div>
  );
}
