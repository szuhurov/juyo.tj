"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/language-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

const content = {
  tg: {
    title: "Нест кардани ҳисоб",
    intro: "Ин саҳифа ба шумо имкон медиҳад, ки нест кардани ҳисоби худ ва тамоми маълумоти шахсии дар JUYO.TJ нигоҳдоштаро дархост кунед — ҳатто агар воридшавӣ ба барнома барои шумо дастрас набошад (масалан парол гум шудааст).",
    whatTitle: "Пас аз тасдиқи дархост чӣ нест мешавад:",
    what: [
      "Профил (ном, насаб, рақами телефон, акс)",
      "Ҳамаи эълонҳои шумо ва суратҳои онҳо",
      "Эълонҳои захирашуда ва блок-листи корбарон",
    ],
    emailLabel: "Почтаи электронии ҳисоби шумо",
    noteLabel: "Изоҳ (ихтиёрӣ)",
    notePlaceholder: "Агар лозим бошад, тафсилоти иловагӣ нависед...",
    submit: "Фиристодани дархост",
    submitting: "Дар ҳоли фиристодан...",
    successTitle: "Дархост қабул шуд",
    successDesc: "Мо дархости шуморо гирифтем. Пас аз тасдиқи шахсият, ҳисоб ва маълумоти шахсии шумо дар муддати 30 рӯз пурра нест карда мешавад.",
    errorInvalidEmail: "Лутфан почтаи электронии дурустро ворид кунед.",
    errorGeneric: "Хатогӣ рӯй дод. Лутфан аз нав кӯшиш кунед ё ба s.zuhurov@outlook.com нависед.",
  },
  ru: {
    title: "Удаление аккаунта",
    intro: "Эта страница позволяет запросить удаление вашего аккаунта и всех личных данных, хранящихся в JUYO.TJ — даже если у вас нет доступа к приложению (например, забыт пароль).",
    whatTitle: "После подтверждения запроса будет удалено:",
    what: [
      "Профиль (имя, фамилия, номер телефона, фото)",
      "Все ваши объявления и их фотографии",
      "Сохранённые объявления и список заблокированных пользователей",
    ],
    emailLabel: "Email вашего аккаунта",
    noteLabel: "Комментарий (необязательно)",
    notePlaceholder: "При необходимости укажите дополнительные детали...",
    submit: "Отправить запрос",
    submitting: "Отправка...",
    successTitle: "Запрос принят",
    successDesc: "Мы получили ваш запрос. После подтверждения личности ваш аккаунт и личные данные будут полностью удалены в течение 30 дней.",
    errorInvalidEmail: "Пожалуйста, введите корректный email.",
    errorGeneric: "Произошла ошибка. Попробуйте снова или напишите на s.zuhurov@outlook.com.",
  },
  en: {
    title: "Delete Account",
    intro: "This page lets you request deletion of your account and all personal data stored on JUYO.TJ — even if you can't sign into the app (e.g. a lost password).",
    whatTitle: "Once your request is confirmed, this will be deleted:",
    what: [
      "Profile (name, phone number, photo)",
      "All your listings and their photos",
      "Saved listings and your blocked-users list",
    ],
    emailLabel: "Your account email",
    noteLabel: "Note (optional)",
    notePlaceholder: "Add any extra details if needed...",
    submit: "Submit request",
    submitting: "Submitting...",
    successTitle: "Request received",
    successDesc: "We've received your request. After identity verification, your account and personal data will be fully deleted within 30 days.",
    errorInvalidEmail: "Please enter a valid email address.",
    errorGeneric: "Something went wrong. Please try again or email s.zuhurov@outlook.com.",
  },
} satisfies Record<string, {
  title: string; intro: string; whatTitle: string; what: string[];
  emailLabel: string; noteLabel: string; notePlaceholder: string;
  submit: string; submitting: string; successTitle: string; successDesc: string;
  errorInvalidEmail: string; errorGeneric: string;
}>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function DeleteAccountContent() {
  const { locale } = useLanguage();
  const c = content[locale as keyof typeof content] || content.en;

  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      toast.error(c.errorInvalidEmail);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/account/request-deletion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, note }),
      });
      if (!res.ok) throw new Error("request failed");
      setSubmitted(true);
    } catch {
      toast.error(c.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="w-14 h-14 rounded-2xl bg-white dark:bg-zinc-900 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="w-7 h-7 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-3">{c.successTitle}</h1>
        <p className="text-zinc-500 font-medium leading-relaxed">{c.successDesc}</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto my-6 px-5 sm:px-8 py-10 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
      <h1 className="text-3xl font-bold mb-4">{c.title}</h1>
      <p className="mb-8 text-zinc-600 dark:text-zinc-400 leading-relaxed">{c.intro}</p>

      <div className="mb-8 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900 flex gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-sm text-amber-800 dark:text-amber-400 mb-2">{c.whatTitle}</p>
          <ul className="text-sm text-amber-700 dark:text-amber-500 space-y-1 list-disc list-inside">
            {c.what.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-bold mb-2">{c.emailLabel}</label>
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
          />
        </div>
        <div>
          <label className="block text-sm font-bold mb-2">{c.noteLabel}</label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={c.notePlaceholder}
            rows={3}
          />
        </div>
        <Button type="submit" disabled={submitting} className="w-full h-12 rounded-xl font-bold">
          {submitting ? c.submitting : c.submit}
        </Button>
      </form>
    </div>
  );
}
