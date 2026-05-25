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
      lastUpdated: "Навсозии охирин: 25 майи соли 2026",
      intro: "Мо ба махфияти шумо эҳтиром мегузорем. Ин ҳуҷҷат мефаҳмонад, ки кадом маълумотро мо ҷамъоварӣ мекунем ва чӣ гуна онро истифода мебарем.",
      sections: [
        {
          title: "1. Ҷамъоварии маълумот",
          text: "Мо маълумоти зеринро ҷамъоварӣ мекунем: ном, насаб, рақами телефон ва суроғаи почтаи электронӣ ҳангоми бақайдгирӣ тавассути Clerk, Google ё Facebook."
        },
        {
          title: "2. Истифодаи маълумот",
          text: "Маълумоти шумо танҳо барои таъмини кори платформаи JUYO, тасдиқи шахсият ва имконияти тамос бо соҳибони ашёҳои гумшуда истифода мешавад."
        },
        {
          title: "3. Хидматҳои шахсони сеюм",
          text: "Мо барои аутентификатсия аз Clerk ва барои нигоҳдории маълумот аз Supabase истифода мебарем. Ин хидматҳо сиёсати махфияти худро доранд."
        },
        {
          title: "4. Ҳуқуқҳои шумо",
          text: "Шумо метавонед дар ҳар вақт маълумоти худро дар танзимоти профил иваз кунед ё дархости нест кардани ҳисоби худро фиристед."
        }
      ]
    },
    ru: {
      title: "Политика конфиденциальности",
      lastUpdated: "Последнее обновление: 25 мая 2026 г.",
      intro: "Мы уважаем вашу конфиденциальность. Этот документ объясняет, какие данные мы собираем и как их используем.",
      sections: [
        {
          title: "1. Сбор информации",
          text: "Мы собираем следующие данные: имя, фамилия, номер телефона и адрес электронной почты при регистрации через Clerk, Google или Facebook."
        },
        {
          title: "2. Использование данных",
          text: "Ваши данные используются исключительно для обеспечения работы платформы JUYO, проверки личности и возможности связи с владельцами утерянных вещей."
        },
        {
          title: "3. Сторонние сервисы",
          text: "Мы используем Clerk для аутентификации и Supabase для хранения данных. Эти сервисы имеют свою политику конфиденциальности."
        },
        {
          title: "4. Ваши права",
          text: "Вы можете в любое время изменить свои данные в настройках профиля или отправить запрос на удаление своей учетной записи."
        }
      ]
    },
    en: {
      title: "Privacy Policy",
      lastUpdated: "Last updated: May 25, 2026",
      intro: "We respect your privacy. This document explains what data we collect and how we use it.",
      sections: [
        {
          title: "1. Data Collection",
          text: "We collect the following data: first name, last name, phone number, and email address when registering via Clerk, Google, or Facebook."
        },
        {
          title: "2. Use of Data",
          text: "Your data is used solely to ensure the operation of the JUYO platform, verify identity, and enable contact with owners of lost items."
        },
        {
          title: "3. Third-party Services",
          text: "We use Clerk for authentication and Supabase for data storage. These services have their own privacy policies."
        },
        {
          title: "4. Your Rights",
          text: "You can change your data in the profile settings at any time or send a request to delete your account."
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
