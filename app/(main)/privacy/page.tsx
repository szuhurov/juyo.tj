/**
 * Саҳифаи сиёсати махфият (Privacy Policy).
 * Ин саҳифа барои талаботи Facebook ва Google ҳатмӣ мебошад.
 */
"use client";

import { useLanguage } from "@/lib/language-context";

export default function PrivacyPage() {
  const { t, locale } = useLanguage();

  const content = {
    tg: {
      title: "Сиёсати махфият",
      lastUpdated: "Навсозии охирин: 16 июни соли 2026",
      intro: "Мо ба махфияти шумо эҳтиром мегузорем. Ин ҳуҷҷат мефаҳмонад, ки кадом маълумотро мо ҷамъоварӣ мекунем ва чӣ гуна онро истифода мебарем. Ин сиёсат ба барномаи мобилии juyo (Android) ва сайти juyo.tj татбиқ мешавад.",
      sections: [
        {
          title: "1. Ҷамъоварии маълумот",
          text: "Мо маълумоти зеринро ҷамъоварӣ мекунем: ном, насаб, рақами телефон ва суроғаи почтаи электронӣ ҳангоми бақайдгирӣ тавассути Clerk, Google ё Apple. Инчунин суратҳои эълонҳое, ки шумо бор мекунед."
        },
        {
          title: "2. Иҷозати камера",
          text: "Барномаи juyo барои скан кардани QR-кодҳо ба камераи дастгоҳ дастрасӣ мепурсад. Мо ягон сурат аз камераро бе иҷозати шумо нигоҳ намедорем. Скани QR танҳо дар дастгоҳи шумо амалӣ мешавад."
        },
        {
          title: "3. Дастрасӣ ба галерея",
          text: "Барои гузоштани суратҳо дар эълонҳо, барнома иҷозати дастрасӣ ба галереяи телефонро мепурсад. Суратҳо танҳо бо иҷозати шумо ба серверҳои Supabase бор карда мешаванд."
        },
        {
          title: "4. Истифодаи маълумот",
          text: "Маълумоти шумо танҳо барои таъмини кори платформаи juyo, тасдиқи шахсият ва имконияти тамос бо соҳибони ашёҳои гумшуда истифода мешавад. Мо маълумоти шуморо ба шахсони сеюм намефурӯшем."
        },
        {
          title: "5. Хидматҳои шахсони сеюм",
          text: "Мо аз хидматҳои зерин истифода мебарем: Clerk (аутентификатсия), Supabase (нигоҳдории маълумот), Vercel Analytics (омори истифодабарандагон). Ин хидматҳо сиёсати махфияти худро доранд."
        },
        {
          title: "6. Нигоҳдории маълумот",
          text: "Маълумоти шумо то вақте ки ҳисоби худро нест кунед нигоҳ дошта мешавад. Пас аз нест кардани ҳисоб, ҳамаи маълумоти шахсӣ дар муддати 30 рӯз пок карда мешавад."
        },
        {
          title: "7. Ҳуқуқҳои шумо",
          text: "Шумо метавонед дар ҳар вақт маълумоти худро дар танзимоти профил иваз кунед ё дархости нест кардани ҳисоби худро ба privacy@juyo.tj фиристед."
        }
      ]
    },
    ru: {
      title: "Политика конфиденциальности",
      lastUpdated: "Последнее обновление: 16 июня 2026 г.",
      intro: "Мы уважаем вашу конфиденциальность. Этот документ объясняет, какие данные мы собираем и как их используем. Данная политика применяется к мобильному приложению juyo (Android) и сайту juyo.tj.",
      sections: [
        {
          title: "1. Сбор информации",
          text: "Мы собираем следующие данные: имя, фамилия, номер телефона и адрес электронной почты при регистрации через Clerk, Google или Apple. Также фотографии объявлений, которые вы загружаете."
        },
        {
          title: "2. Разрешение на камеру",
          text: "Приложение juyo запрашивает доступ к камере устройства для сканирования QR-кодов. Мы не сохраняем никаких снимков с камеры без вашего разрешения. Сканирование QR выполняется только на вашем устройстве."
        },
        {
          title: "3. Доступ к галерее",
          text: "Для добавления фотографий к объявлениям приложение запрашивает доступ к галерее телефона. Фотографии загружаются на серверы Supabase только с вашего разрешения."
        },
        {
          title: "4. Использование данных",
          text: "Ваши данные используются исключительно для обеспечения работы платформы juyo, проверки личности и возможности связи с владельцами утерянных вещей. Мы не продаём ваши данные третьим лицам."
        },
        {
          title: "5. Сторонние сервисы",
          text: "Мы используем следующие сервисы: Clerk (аутентификация), Supabase (хранение данных), Vercel Analytics (статистика пользователей). Эти сервисы имеют свою политику конфиденциальности."
        },
        {
          title: "6. Хранение данных",
          text: "Ваши данные хранятся до тех пор, пока вы не удалите свой аккаунт. После удаления аккаунта все личные данные удаляются в течение 30 дней."
        },
        {
          title: "7. Ваши права",
          text: "Вы можете в любое время изменить свои данные в настройках профиля или отправить запрос на удаление учётной записи на privacy@juyo.tj."
        }
      ]
    },
    en: {
      title: "Privacy Policy",
      lastUpdated: "Last updated: June 16, 2026",
      intro: "We respect your privacy. This document explains what data we collect and how we use it. This policy applies to the juyo mobile app (Android) and the website juyo.tj.",
      sections: [
        {
          title: "1. Data Collection",
          text: "We collect the following data: first name, last name, phone number, and email address when registering via Clerk, Google, or Apple. Also photos of listings that you upload."
        },
        {
          title: "2. Camera Permission",
          text: "The juyo app requests access to the device camera to scan QR codes. We do not store any photos from the camera without your permission. QR scanning is performed only on your device."
        },
        {
          title: "3. Gallery Access",
          text: "To add photos to listings, the app requests access to the phone gallery. Photos are uploaded to Supabase servers only with your permission."
        },
        {
          title: "4. Use of Data",
          text: "Your data is used solely to ensure the operation of the juyo platform, verify identity, and enable contact with owners of lost items. We do not sell your data to third parties."
        },
        {
          title: "5. Third-party Services",
          text: "We use the following services: Clerk (authentication), Supabase (data storage), Vercel Analytics (user statistics). These services have their own privacy policies."
        },
        {
          title: "6. Data Retention",
          text: "Your data is retained until you delete your account. After account deletion, all personal data is erased within 30 days."
        },
        {
          title: "7. Your Rights",
          text: "You can change your data in profile settings at any time or send a request to delete your account to privacy@juyo.tj."
        }
      ]
    }
  };

  const currentContent = content[locale as keyof typeof content] || content.en;

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-4">{currentContent.title}</h1>
      <p className="text-sm text-zinc-500 mb-8">{currentContent.lastUpdated}</p>
      
      <p className="mb-8 text-lg text-zinc-700 dark:text-zinc-300">
        {currentContent.intro}
      </p>

      <div className="space-y-8">
        {currentContent.sections.map((section, index) => (
          <div key={index}>
            <h2 className="text-xl font-semibold mb-3">{section.title}</h2>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {section.text}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-12 pt-8 border-t text-sm text-zinc-500">
        <p>Email: privacy@juyo.tj</p>
      </div>
    </div>
  );
}
