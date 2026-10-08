"use client";

/**
 * Content of the Privacy Policy page. Opens in Russian by default (owner
 * request) whatever the site language is; the buttons on top switch only
 * this page, styled like the sign-in / sign-up language buttons.
 * Metadata (title/description) is handled in the parent page.tsx.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";

const content = {
  tg: {
    title: "Сиёсати махфият",
    lastUpdated: "Навсозии охирин: 7 октябри соли 2026",
    intro: "Мо ба махфияти шумо эҳтиром мегузорем. Ин ҳуҷҷат мефаҳмонад, ки кадом маълумотро ҷамъ мекунем, барои чӣ, бо кӣ мубодила мекунем ва кай нест мекунем. Ин сиёсат ба барномаи мобилии JUYO (Android ва iOS) ва сайти juyo.tj татбиқ мешавад.",
    sections: [
      {
        id: "data",
        title: "1. Маълумоте, ки ҷамъ мекунем",
        text: "Ҳисоб: ном, насаб, суроғаи почтаи электронӣ ва расми профил — ҳангоми бақайдгирӣ бо почта ва парол, Google ё Apple. Ҳангоми вуруд бо Apple шумо метавонед почтаи худро пинҳон кунед. Тамос: рақами телефон ва, агар хоҳед, рақами дуюм ва шабакаҳои иҷтимоӣ (Telegram, WhatsApp ва ғ.). Эълонҳо: сарлавҳа, тавсиф, категория, шаҳр, намуди ҷой, мукофот ва суратҳое, ки худатон бор мекунед. Инчунин: эълонҳои захирашуда ва токени огоҳиномаҳо (push), агар огоҳиномаҳоро иҷозат диҳед. Мо ҷойгиршавии (GPS) дастгоҳро ҷамъ намекунем, реклама ва пайгирӣ (tracking) надорем."
      },
      {
        id: "camera",
        title: "2. Камера ва галерея",
        text: "Камера барои скан кардани QR-кодҳои JUYO ва гирифтани акси ашё истифода мешавад. Скани QR дар дастгоҳи шумо иҷро мешавад. Галерея барои илова кардани акс ба эълон ва сабти QR-и шумо истифода мешавад. Пеш аз боркунӣ маълумоти пинҳонии акс (EXIF, аз ҷумла ҷойгиршавии GPS) нест карда мешавад. Дар ҳар акс шумо метавонед бо тугмаи «Пинҳон кардани маълумоти шахсӣ» рақамҳо, номҳо ва чеҳраҳоро худатон пӯшонед ё аксро пурра пинҳон кунед — он гоҳ акс бор карда намешавад. Акси ҳуҷҷат ва корти бонкӣ ҳеҷ гоҳ бор карда намешавад: дар эълонҳои категорияҳои «Ҳуҷҷат» ва «Корт» ба ҷои акс тасвири JUYO нишон дода мешавад. Пӯшиш ба худи акс доимо сабт мешавад ва акси аслии пӯшиданашуда ба сервер фиристода намешавад. Рақамҳои ҳуҷҷат ва корти бонкӣ дар матни эълон худкор пинҳон мешаванд. Ҳангоми нашри эълон барнома ҳар аксро дар дастгоҳи шумо ба як қатор рақамҳо табдил медиҳад, ки намуди ашёро тасвир мекунанд (модели SigLIP 2, ки дар худи барнома аст). JUYO ин рақамҳоро бо эълон нигоҳ медорад: танҳо барои ёфтани эълонҳои монанд (ҷустуҷӯ бо акс). Аз ин рақамҳо худи аксро барқарор кардан мумкин нест. Ҳангоми ҷустуҷӯ бо акс танҳо ин рақамҳо фиристода мешаванд, на акс."
      },
      {
        id: "usage",
        title: "3. Истифодаи маълумот",
        text: "Маълумоти шумо танҳо барои кори JUYO истифода мешавад: ҳисоб ва вуруд, нашри эълонҳо, ҷустуҷӯ ва мутобиқатҳои эҳтимолӣ (аз рӯи матн, категория, шаҳр ва сана — бо қоидаҳо, бе зеҳни сунъӣ), тамос байни соҳиб ва ёбанда ва огоҳиномаҳо. Ҳар эълон пеш аз нашр аз ҷониби модератор санҷида мешавад (ба истиснои эълонҳои корбароне, ки модератор онҳоро боэътимод қайд кардааст). JUYO маълумоти шуморо ба ягон хидмати зеҳни сунъӣ (AI) намефиристад. Мо маълумоти шуморо намефурӯшем ва барои реклама истифода намебарем."
      },
      {
        id: "public",
        title: "4. Чӣ ба ҳама намоён аст",
        text: "Эълони тасдиқшуда (матн ва суратҳо) барои ҳама, ҳатто бе ҳисоб, намоён аст. Суратҳои эълон бо пайванди умумӣ нигоҳ дошта мешаванд — ҳар касе, ки пайвандро дорад, метавонад суратро кушояд. Рақами телефон ва шабакаҳои эълон ба бинанда барои тамос нишон дода мешаванд. QR-и шумо танҳо ҳамон маълумотеро нишон медиҳад, ки худатон ворид кардаед, ва онро дар ҳар лаҳза бо тумблери «Статуси QR-код» хомӯш карда метавонед. Дар эълони ҳуҷҷат номи соҳиб танҳо бо ном ва ҳарфи аввали насаб нишон дода мешавад, ва ҳар чунин эълонро модератор пеш аз нашр месанҷад. Агар эълон ҳуҷҷат ё номи шуморо нишон диҳад, ба s.zuhurov@outlook.com нависед — мо онро пинҳон ё нест мекунем."
      },
      {
        id: "third-party",
        title: "5. Хидматҳое, ки маълумотро коркард мекунанд",
        text: "Clerk (ИМА) — ҳисоб ва вуруд (почта, ном, вуруд бо Google/Apple). Supabase (серверҳо дар Токио, Ҷопон) — пойгоҳи маълумот ва нигоҳдории суратҳо. Хидмати огоҳиномаҳои Expo (ИМА) ва Apple/Google — расонидани push-огоҳиномаҳо. Vercel (ИМА) — ҷойгиркунии сайт ва омори умумии боздид (Vercel Analytics, танҳо дар сайт). Маълумоти шумо дар серверҳои берун аз Тоҷикистон (Ҷопон ва ИМА) нигоҳ дошта ва коркард мешавад. Огоҳиномаҳо дар сайт тавассути хидмати push-и браузери шумо (масалан Google ё Mozilla) мерасанд. Ин хидматҳо маълумотро танҳо барои кори JUYO коркард мекунанд ва сиёсати махфияти худро доранд."
      },
      {
        id: "retention",
        title: "6. Нигоҳдорӣ ва нест кардан",
        text: "Маълумоти ҳисоб то он даме нигоҳ дошта мешавад, ки шумо онро нест кунед. Эълонҳо пас аз мӯҳлати худ (пешфарз 180 рӯз) худкор нест мешаванд; пеш аз он огоҳинома мегиред. Вақте ки ҳисобро нест мекунед, ҳисоб, профил, эълонҳо, суратҳо (бо нусхаҳои хурди онҳо), захирашудаҳо, токенҳо ва таърихи огоҳиномаҳо фавран нест карда мешаванд — мо нусхаи онҳоро нигоҳ намедорем. Агар нест карданро тавассути саҳифаи juyo.tj/delete-account дархост кунед, худи дархост (почта ва шарҳ) ҳамчун сабти иҷрои он нигоҳ дошта мешавад. Омори умумии эълонҳо (масалан, шумораи эълонҳои ёфтшуда) бе пайванд ба шахси шумо боқӣ мемонад. Нусхаҳои эҳтиётии (backup) провайдерон муддати маҳдуд то навсозии худкор боқӣ монда метавонанд."
      },
      {
        id: "rights",
        title: "7. Ҳуқуқҳои шумо",
        text: "Шумо метавонед маълумоти худро дар танзимоти профил иваз кунед, огоҳиномаҳо ва QR-ро хомӯш кунед ва ҳисобро дар Танзимот → «Нест кардани ҳисоб» нест кунед. Бе воридшавӣ — саҳифаи juyo.tj/delete-account-ро кушоед ё ба s.zuhurov@outlook.com нависед. Барои гирифтани нусхаи маълумоти худ ё ислоҳи он низ ба ҳамин почта нависед — мо дар давоми 30 рӯз ҷавоб медиҳем."
      },
      {
        id: "imported",
        title: "8. Эълонҳо аз манбаъҳои дигар",
        text: "Дар пойгоҳи JUYO инчунин эълонҳое ҳастанд, ки аз эълонҳои ошкоро дар сайти Somon.tj ва каналҳои Telegram нусхабардорӣ шудаанд (матн, акс ва рақами телефон). Агар дар чунин эълон маълумоти шумо бошад, ба s.zuhurov@outlook.com нависед — мо онро нест мекунем."
      },
      {
        id: "cookies",
        title: "9. Cookie ва хотираи браузер",
        text: "Сайт cookie-ҳои Clerk-ро барои вуруд, cookie-и «juyo-locale» (забон, 1 сол) ва хотираи браузер (localStorage) барои забон, мавзӯъ (торик/равшан) ва ҳисоби боздидҳоро истифода мебарад. Vercel Analytics cookie истифода намебарад. Реклама ва пайгирӣ нест."
      },
      {
        id: "age",
        title: "10. Синну сол",
        text: "JUYO барои корбарони аз 18-сола боло пешбинӣ шудааст. Мо дидаву дониста маълумоти кӯдаконро ҷамъ намекунем."
      },
      {
        id: "qr",
        title: "11. QR-код",
        text: "QR-и JUYO бепул аст — онро бе ҳеҷ маҳдудият боргирӣ мекунед. Рақами дуюм ва шабакаҳои иҷтимоӣ роҳи эҳтиётии тамосанд: агар телефони шумо гум шавад ё ҷавоб надиҳед, ёбанда аз он ҷо ба шумо мерасад — шабакаҳо ихтиёрианд."
      },
      {
        id: "changes",
        title: "12. Тағйирот",
        text: "Агар ин сиёсат тағйир ёбад, санаи боло нав мешавад. Барои саволҳо ба s.zuhurov@outlook.com нависед."
      }
    ]
  },
  ru: {
    title: "Политика конфиденциальности",
    lastUpdated: "Последнее обновление: 7 октября 2026 г.",
    intro: "Мы уважаем вашу конфиденциальность. Этот документ объясняет, какие данные мы собираем, зачем, с кем ими делимся и когда удаляем. Политика применяется к мобильному приложению JUYO (Android и iOS) и сайту juyo.tj.",
    sections: [
      {
        id: "data",
        title: "1. Какие данные мы собираем",
        text: "Аккаунт: имя, фамилия, адрес электронной почты и фото профиля — при регистрации по почте и паролю, через Google или Apple. При входе через Apple вы можете скрыть свою почту. Контакты: номер телефона и, по желанию, второй номер и соцсети (Telegram, WhatsApp и др.). Объявления: заголовок, описание, категория, город, тип места, вознаграждение и фотографии, которые вы сами загружаете. А также: сохранённые объявления и токен уведомлений (push), если вы их разрешили. Мы не собираем геолокацию (GPS) устройства, у нас нет рекламы и отслеживания (tracking)."
      },
      {
        id: "camera",
        title: "2. Камера и галерея",
        text: "Камера используется для сканирования QR-кодов JUYO и фотографирования вещей. Сканирование QR выполняется на вашем устройстве. Галерея используется для добавления фото к объявлению и сохранения вашего QR. Перед загрузкой скрытые данные фото (EXIF, в том числе GPS-координаты) удаляются. На любом фото вы можете закрыть номера, имена и лица вручную или скрыть фото целиком — тогда оно не загружается. Фото документов и банковских карт никогда не загружаются: в объявлениях категорий «Документ» и «Карты» вместо фото показывается изображение JUYO. Закрашивание сохраняется в самом фото навсегда, а исходное незакрытое фото на сервер не отправляется. Номера документов и банковских карт в тексте объявления скрываются автоматически. При публикации объявления приложение на вашем устройстве превращает каждое фото в набор чисел, описывающих внешний вид вещи (модель SigLIP 2, встроенная в приложение). JUYO хранит эти числа вместе с объявлением: только для поиска похожих объявлений (поиск по фото). Восстановить фото по этим числам нельзя. При поиске по фото отправляются только эти числа, а не фото."
      },
      {
        id: "usage",
        title: "3. Как мы используем данные",
        text: "Данные используются только для работы JUYO: аккаунт и вход, публикация объявлений, поиск и возможные совпадения (по тексту, категории, городу и дате — по правилам, без искусственного интеллекта), связь между владельцем и нашедшим и уведомления. Каждое объявление проверяет модератор перед публикацией (кроме объявлений пользователей, отмеченных модератором как доверенные). JUYO не передаёт ваши данные никаким сервисам искусственного интеллекта (AI). Мы не продаём ваши данные и не используем их для рекламы."
      },
      {
        id: "public",
        title: "4. Что видно всем",
        text: "Одобренное объявление (текст и фото) видно всем, даже без аккаунта. Фотографии объявлений хранятся по публичной ссылке — любой, у кого есть ссылка, может открыть фото. Номер телефона и соцсети объявления показываются посетителю для связи. Ваш QR показывает только те данные, которые вы сами ввели, и его можно отключить в любой момент переключателем «Статус QR-кода». В объявлении о документе имя владельца показывается только как имя и первая буква фамилии, и каждое такое объявление модератор проверяет до публикации. Если объявление показывает ваш документ или имя, напишите на s.zuhurov@outlook.com — мы скроем или удалим его."
      },
      {
        id: "third-party",
        title: "5. Сервисы, которые обрабатывают данные",
        text: "Clerk (США) — аккаунт и вход (почта, имя, вход через Google/Apple). Supabase (серверы в Токио, Япония) — база данных и хранение фотографий. Сервис уведомлений Expo (США) и Apple/Google — доставка push-уведомлений. Vercel (США) — хостинг сайта и общая статистика посещений (Vercel Analytics, только на сайте). Ваши данные хранятся и обрабатываются на серверах за пределами Таджикистана (Япония и США). Уведомления на сайте приходят через push-сервис вашего браузера (например, Google или Mozilla). Эти сервисы обрабатывают данные только для работы JUYO и имеют собственные политики конфиденциальности."
      },
      {
        id: "retention",
        title: "6. Хранение и удаление",
        text: "Данные аккаунта хранятся, пока вы его не удалите. Объявления удаляются автоматически по истечении срока (по умолчанию 180 дней); перед этим вы получаете уведомление. Когда вы удаляете аккаунт, аккаунт, профиль, объявления, фотографии (вместе с их уменьшенными копиями), сохранённое, токены и история уведомлений удаляются сразу — мы не храним их копий. Если вы запросили удаление через страницу juyo.tj/delete-account, сам запрос (почта и комментарий) сохраняется как запись о его выполнении. Общая статистика объявлений (например, число найденных вещей) остаётся без связи с вами. Резервные копии (backup) провайдеров могут храниться ограниченное время до автоматической перезаписи."
      },
      {
        id: "rights",
        title: "7. Ваши права",
        text: "Вы можете изменить свои данные в настройках профиля, отключить уведомления и QR и удалить аккаунт в Настройки → «Удалить аккаунт». Без входа — откройте juyo.tj/delete-account или напишите на s.zuhurov@outlook.com. Чтобы получить копию своих данных или исправить их, также напишите на этот адрес — мы ответим в течение 30 дней."
      },
      {
        id: "imported",
        title: "8. Объявления из других источников",
        text: "В базе JUYO также есть объявления, скопированные из открытых объявлений сайта Somon.tj и Telegram-каналов (текст, фото и номер телефона). Если в таком объявлении есть ваши данные, напишите на s.zuhurov@outlook.com — мы удалим его."
      },
      {
        id: "cookies",
        title: "9. Cookie и хранилище браузера",
        text: "Сайт использует cookie Clerk для входа, cookie «juyo-locale» (язык, 1 год) и хранилище браузера (localStorage) для языка, темы (тёмная/светлая) и подсчёта просмотров. Vercel Analytics не использует cookie. Рекламы и отслеживания нет."
      },
      {
        id: "age",
        title: "10. Возраст",
        text: "JUYO предназначен для пользователей старше 18 лет. Мы сознательно не собираем данные детей."
      },
      {
        id: "qr",
        title: "11. QR-код",
        text: "QR-код JUYO бесплатный — скачивайте без ограничений. Второй номер и соцсети — запасной способ связи: если ваш телефон потерян или вы не отвечаете, нашедший свяжется с вами там; соцсети необязательны."
      },
      {
        id: "changes",
        title: "12. Изменения",
        text: "Если политика изменится, дата выше обновится. По вопросам пишите на s.zuhurov@outlook.com."
      }
    ]
  },
  en: {
    title: "Privacy Policy",
    lastUpdated: "Last updated: October 7, 2026",
    intro: "We respect your privacy. This document explains what data we collect, why, who we share it with and when we delete it. It applies to the JUYO mobile app (Android and iOS) and the website juyo.tj.",
    sections: [
      {
        id: "data",
        title: "1. Data we collect",
        text: "Account: first and last name, email address and profile photo — when you sign up with email and password, Google or Apple. With Sign in with Apple you can hide your email. Contact: phone number and, if you choose, a second number and social accounts (Telegram, WhatsApp, etc.). Listings: title, description, category, city, place type, reward and the photos you upload. Also: saved listings and a push notification token if you allow notifications. We do not collect your device location (GPS), and there is no advertising or tracking."
      },
      {
        id: "camera",
        title: "2. Camera and photos",
        text: "The camera is used to scan JUYO QR codes and to photograph items. QR scanning happens on your device. The photo library is used to add photos to a listing and to save your QR code. Hidden photo data (EXIF, including GPS location) is removed before upload. On any photo you can cover numbers, names and faces yourself, or hide the whole photo — then it is not uploaded. Photos of documents and bank cards are never uploaded: listings in the Documents and Cards categories show a JUYO image instead. The covering is saved into the photo permanently, and the uncovered original is never sent to our servers. Document and bank card numbers in the listing text are hidden automatically. When you publish a listing, the app turns each photo, on your device, into a set of numbers that describes how the item looks (the SigLIP 2 model built into the app). JUYO stores these numbers with the listing only to find similar listings (search by photo). The photo cannot be rebuilt from these numbers. When you search by photo, only these numbers are sent, never the photo."
      },
      {
        id: "usage",
        title: "3. How we use data",
        text: "Your data is used only to run JUYO: your account and sign-in, publishing listings, search and possible matches (based on text, category, city and date — rule-based, no artificial intelligence), contact between owner and finder, and notifications. Every listing is reviewed by a moderator before it is published (except listings by users the moderator has marked as trusted). JUYO does not send your data to any artificial intelligence (AI) service. We do not sell your data or use it for advertising."
      },
      {
        id: "public",
        title: "4. What is public",
        text: "An approved listing (text and photos) is visible to everyone, even without an account. Listing photos are stored at public links — anyone with the link can open the photo. The listing's phone number and social accounts are shown to visitors so they can contact you. Your QR shows only the data you entered yourself, and you can switch it off at any time with the QR status toggle. In a listing about a document, the owner's name is shown only as first name and the first letter of the surname, and a moderator checks every such listing before it is published. If a listing shows your document or name, email s.zuhurov@outlook.com and we will hide or remove it."
      },
      {
        id: "third-party",
        title: "5. Services that process data",
        text: "Clerk (USA) — account and sign-in (email, name, Google/Apple sign-in). Supabase (servers in Tokyo, Japan) — database and photo storage. Expo push service (USA) and Apple/Google — delivering push notifications. Vercel (USA) — website hosting and aggregate visit statistics (Vercel Analytics, website only). Your data is stored and processed on servers outside Tajikistan (Japan and the USA). Website notifications are delivered through your browser's push service (for example Google or Mozilla). These services process data only to run JUYO and have their own privacy policies."
      },
      {
        id: "retention",
        title: "6. Retention and deletion",
        text: "Account data is kept until you delete your account. Listings are deleted automatically when they expire (180 days by default); you get a notice before that. When you delete your account, your account, profile, listings, photos (including their smaller copies), saved items, notification tokens and notification history are deleted immediately — we keep no copy. If you request deletion through juyo.tj/delete-account, the request itself (email and note) is kept as a record that it was carried out. Aggregate listing statistics (for example, how many items were found) remain without any link to you. Our providers' backups may keep data for a limited time until they are overwritten automatically."
      },
      {
        id: "rights",
        title: "7. Your rights",
        text: "You can change your data in profile settings, turn off notifications and your QR, and delete your account in Settings → \"Delete Account\". Without signing in, visit juyo.tj/delete-account or email s.zuhurov@outlook.com. To get a copy of your data or have it corrected, email the same address — we reply within 30 days."
      },
      {
        id: "imported",
        title: "8. Listings from other sources",
        text: "JUYO's database also contains listings copied from public announcements on Somon.tj and Telegram channels (text, photos and phone number). If such a listing contains your data, email s.zuhurov@outlook.com and we will remove it."
      },
      {
        id: "cookies",
        title: "9. Cookies and browser storage",
        text: "The website uses Clerk cookies for sign-in, a \"juyo-locale\" cookie (language, 1 year) and browser storage (localStorage) for language, theme (dark/light) and view counting. Vercel Analytics does not use cookies. There is no advertising or tracking."
      },
      {
        id: "age",
        title: "10. Age",
        text: "JUYO is intended for users aged 18 and over. We do not knowingly collect data from children."
      },
      {
        id: "qr",
        title: "11. QR code",
        text: "The JUYO QR code is free — download it without limits. The second number and social accounts are a backup route: if your phone is lost or you do not answer, the finder can still reach you there — social accounts are optional."
      },
      {
        id: "changes",
        title: "12. Changes",
        text: "If this policy changes, the date above is updated. For questions, email s.zuhurov@outlook.com."
      }
    ]
  }
} satisfies Record<string, { title: string; lastUpdated: string; intro: string; sections: { id: string; title: string; text: string }[] }>;

const LANGUAGES = [
  { code: "tg", label: "Тоҷикӣ" },
  { code: "ru", label: "Русский" },
  { code: "en", label: "English" },
] as const;

type PolicyLocale = (typeof LANGUAGES)[number]["code"];

export function PrivacyContent() {
  const [locale, setLocale] = useState<PolicyLocale>("ru");
  const currentContent = content[locale];

  return (
    <div className="max-w-3xl mx-auto my-6 px-4 sm:px-8 py-10 rounded-md bg-white dark:bg-zinc-800 border border-hairline dark:border-zinc-700">
      <div className="flex justify-center gap-1.5 sm:gap-2 mb-8">
        {LANGUAGES.map((lang) => (
          <Button
            key={lang.code}
            variant={locale === lang.code ? "default" : "outline"}
            size="sm"
            onClick={() => setLocale(lang.code)}
            aria-pressed={locale === lang.code}
            lang={lang.code}
            className={`font-medium rounded-md px-3 sm:px-4 h-8 sm:h-9 transition-all text-[10px] sm:text-xs ${
              locale === lang.code
                ? "bg-emerald-500 text-white"
                : "bg-white dark:bg-zinc-900 text-slate-600 hover:text-zinc-900 border-hairline dark:border-zinc-800"
            }`}
          >
            {lang.label}
          </Button>
        ))}
      </div>

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
