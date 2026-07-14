/**
 * Дарвозаи санҷиши моликият барои эълонҳои "Ёфтшуда".
 * Агар финдер савол(ҳо) гузошта бошад, ин компонент ба ҷои тугмаи "Занг задан"
 * форма нишон медиҳад. Пас аз ҷавоб додан, финдер (соҳиби эълон) ҷавобҳоро
 * дар ҳамин компонент (agar u sohib boshad) мебинад ва тасдиқ/рад мекунад.
 */
"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@clerk/nextjs";
import { supabase as anonSupabase, createClerkSupabaseClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Phone, ShieldQuestion, Loader2, CheckCircle2, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { getTemplatesForCategory } from "@/lib/verification-questions";
import { ClaimantAvatar } from "@/components/claimant-avatar";
import { cn } from "@/lib/utils";

interface Question {
  id: string;
  question_text: string;
  answer_type: "yesno" | "input";
  sort_order: number;
}

interface Attempt {
  id: string;
  answers: { question_id: string; question_text: string; answer_type: string; given_answer: string }[];
  status: string;
  created_at: string;
  claimant_phone: string | null;
  matched_user_id: string | null;
  matched_first_name: string | null;
  matched_last_name: string | null;
  matched_avatar_url: string | null;
}

function getClaimantToken(userId: string | null | undefined): string {
  if (userId) return `user_${userId}`;
  if (typeof window === "undefined") return "anon";
  let token = localStorage.getItem("juyo_claimant_token");
  if (!token) {
    token = `anon_${crypto.randomUUID()}`;
    localStorage.setItem("juyo_claimant_token", token);
  }
  return token;
}

export function VerificationGate({
  itemId,
  isOwner,
  phoneNumber,
  category,
}: {
  itemId: string;
  isOwner: boolean;
  phoneNumber?: string | null;
  category?: string | null;
}) {
  const { t, locale } = useLanguage();
  const { userId, getToken } = useAuth();

  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"none" | "pending_review" | "passed" | "rejected">("none");
  const [phone, setPhone] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [claimantPhone, setClaimantPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Ҳолати саволҳои умумии по-default (вақте ки финдер худаш савол
  // насохтааст) — пеш аз намоиши тугмаи "Занг задан" як бор пурсида мешавад.
  const [defaultAnswers, setDefaultAnswers] = useState<Record<string, string>>({});
  const [defaultAnswered, setDefaultAnswered] = useState(false);

  // Owner-review state
  const [pendingAttempts, setPendingAttempts] = useState<Attempt[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await anonSupabase.rpc("get_verification_questions", { p_item_id: itemId });
      setQuestions(data ?? []);

      if (!isOwner && data && data.length > 0) {
        const token = getClaimantToken(userId);
        const { data: statusData } = await anonSupabase.rpc("get_verification_status", {
          p_item_id: itemId,
          p_claimant_token: token,
        });
        const row = statusData?.[0];
        if (row && row.status !== "none") {
          setStatus(row.status);
          setPhone(row.phone ?? null);
        }
      }
      setLoading(false);
    };
    load();
  }, [itemId, isOwner, userId]);

  // Owner: load pending review attempts for this item.
  useEffect(() => {
    if (!isOwner || !userId) return;
    const loadAttempts = async () => {
      const token = await getToken({ template: "supabase" });
      if (!token) return;
      const supabase = createClerkSupabaseClient(token);
      const { data } = await supabase.rpc("get_pending_verification_attempts", { p_item_id: itemId });
      setPendingAttempts((data as any) ?? []);
    };
    loadAttempts();
  }, [isOwner, userId, itemId, getToken]);

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async () => {
    if (!questions) return;
    if (questions.some((q) => !answers[q.id]?.trim())) {
      toast.error(t("verifyFillAllAnswers"));
      return;
    }
    if (!claimantPhone.trim()) {
      toast.error(t("verifyPhoneRequired"));
      return;
    }
    setSubmitting(true);
    try {
      const token = getClaimantToken(userId);
      const payload = questions.map((q) => ({ question_id: q.id, given_answer: answers[q.id] }));
      const { data, error } = await anonSupabase.rpc("submit_verification_attempt", {
        p_item_id: itemId,
        p_claimant_token: token,
        p_answers: payload,
        p_claimant_phone: claimantPhone.trim(),
      });
      if (error) throw error;
      const row = data?.[0];
      setStatus(row.status);
      setPhone(row.phone ?? null);
    } catch (e: any) {
      toast.error(e.message || t("error"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Button size="lg" disabled className="h-14 md:h-16 w-full rounded-2xl font-black bg-zinc-200 text-zinc-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </Button>
    );
  }

  // Owner: рӯйхати маъмулии хурд — аввал танҳо ном/насаб, click ба иконаи
  // "?" ҷавобҳо ва тугмаи зангро мекушояд. Ягон тасдиқ/рад нест — соҳиб
  // худаш интихоб мекунад, ки бо кӣ занг занад.
  if (isOwner) {
    if (!pendingAttempts || pendingAttempts.length === 0) return null;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-2xl px-4 py-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
            <ShieldQuestion className="w-5 h-5 text-amber-600" />
          </div>
          <span className="text-sm font-black text-amber-800 dark:text-amber-300 tracking-tight">
            {t("verifyPendingCount").replace("%{count}", String(pendingAttempts.length))}
          </span>
        </div>
        <div className="space-y-3">
          {pendingAttempts.map((attempt) => {
            const name = `${attempt.matched_first_name ?? ""} ${attempt.matched_last_name ?? ""}`.trim();
            const expanded = expandedId === attempt.id;
            return (
              <div
                key={attempt.id}
                className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : attempt.id)}
                  className="w-full flex items-center justify-between gap-3 p-4 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ClaimantAvatar url={attempt.matched_avatar_url} name={name} className="w-11 h-11 text-sm shadow-sm" />
                    <span className="text-sm font-black text-zinc-900 dark:text-zinc-100 truncate">
                      {name || t("verifyUnknownClaimant")}
                    </span>
                  </div>
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors",
                      expanded ? "bg-zinc-900 dark:bg-white" : "bg-zinc-100 dark:bg-zinc-800",
                    )}
                  >
                    <HelpCircle
                      className={cn("w-4 h-4", expanded ? "text-white dark:text-zinc-900" : "text-zinc-400")}
                    />
                  </div>
                </button>
                {expanded && (
                  <div className="px-4 pb-4 space-y-2.5 border-t border-zinc-100 dark:border-zinc-800 pt-3.5">
                    {attempt.answers.map((a) => (
                      <div key={a.question_id} className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3">
                        <p className="text-[11px] font-bold text-zinc-400 mb-0.5">{a.question_text}</p>
                        <p className="text-sm font-black text-zinc-900 dark:text-zinc-100">
                          {a.answer_type === "yesno" ? (a.given_answer === "yes" ? t("verifyYes") : t("verifyNo")) : a.given_answer}
                        </p>
                      </div>
                    ))}
                    {attempt.claimant_phone && (
                      <a
                        href={`tel:${attempt.claimant_phone}`}
                        className="flex items-center justify-center gap-2 h-12 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-black text-sm shadow-md hover:shadow-lg active:scale-[0.98] transition-all mt-1"
                      >
                        <Phone className="w-4 h-4" /> {t("call")}
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Претендент, финдер ҳеҷ саволе насохтааст — як бор саволҳои умумии
  // категория (by default) пурсида мешавад, баъд тугмаи "Занг задан" пайдо
  // мешавад. Ин ҷавобҳо ба сервер фиристода намешаванд ва аз ҷониби соҳиб
  // баррасӣ карда намешаванд (ҳамон рӯҳияи "бе саволи финдер = дастрасии
  // фаврӣ", танҳо бо каме монеаи бештар нисбат ба як тасдиқи оддӣ).
  if (!questions || questions.length === 0) {
    const defaultQuestions = getTemplatesForCategory(category || "Other").slice(0, 2);

    if (!defaultAnswered) {
      return (
        <div className="space-y-4 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 font-black text-xs uppercase tracking-wider">
            <ShieldQuestion className="w-4 h-4" />
            {t("verifyAnswerQuestions")}
          </div>
          <p className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 leading-relaxed">
            {t("verifyDefaultQuestionsHint")}
          </p>

          {defaultQuestions.map((q) => (
            <div key={q.id} className="space-y-1.5">
              <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                {q.text[locale as keyof typeof q.text] ?? q.text.tg}
              </p>
              {q.type === "yesno" ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDefaultAnswers((prev) => ({ ...prev, [q.id]: "yes" }))}
                    className={`flex-1 h-10 rounded-lg text-xs font-black border-2 ${defaultAnswers[q.id] === "yes" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-zinc-200 text-zinc-500"}`}
                  >
                    {t("verifyYes")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDefaultAnswers((prev) => ({ ...prev, [q.id]: "no" }))}
                    className={`flex-1 h-10 rounded-lg text-xs font-black border-2 ${defaultAnswers[q.id] === "no" ? "border-red-500 bg-red-50 text-red-700" : "border-zinc-200 text-zinc-500"}`}
                  >
                    {t("verifyNo")}
                  </button>
                </div>
              ) : (
                <Input
                  value={defaultAnswers[q.id] || ""}
                  onChange={(e) => setDefaultAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder={t("verifyAnswerPlaceholder")}
                  className="rounded-lg h-10 text-xs font-bold"
                />
              )}
            </div>
          ))}

          <Button
            onClick={() => {
              if (defaultQuestions.some((q) => !defaultAnswers[q.id]?.trim())) {
                toast.error(t("verifyFillAllAnswers"));
                return;
              }
              setDefaultAnswered(true);
            }}
            className="w-full h-12 rounded-xl font-black text-xs bg-zinc-900 hover:bg-zinc-800 text-white"
          >
            {t("continue")}
          </Button>
        </div>
      );
    }

    return (
      <Button
        size="lg"
        className="h-14 md:h-16 w-full rounded-2xl font-black bg-zinc-900 hover:bg-zinc-800 text-white shadow-lg"
        asChild
      >
        <a href={`tel:${phoneNumber}`}>
          <Phone className="w-5 h-5 md:w-6 md:h-6 mr-2" /> {t("call")}
        </a>
      </Button>
    );
  }

  if (status === "passed" && phone) {
    return (
      <Button size="lg" className="h-14 md:h-16 w-full rounded-2xl font-black bg-zinc-900 hover:bg-zinc-800 text-white shadow-lg" asChild>
        <a href={`tel:${phone}`}>
          <Phone className="w-5 h-5 md:w-6 md:h-6 mr-2" /> {t("call")}
        </a>
      </Button>
    );
  }

  if (status === "pending_review") {
    return (
      <div className="h-14 md:h-16 w-full rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 flex items-center justify-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-sm px-4 text-center">
        <CheckCircle2 className="w-5 h-5 shrink-0" /> {t("verifyPendingReview")}
      </div>
    );
  }

  // status === 'none' or 'rejected' -> show the question form.
  return (
    <div className="space-y-4 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800 rounded-2xl p-5">
      <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 font-black text-xs uppercase tracking-wider">
        <ShieldQuestion className="w-4 h-4" />
        {t("verifyAnswerQuestions")}
      </div>

      {status === "rejected" && (
        <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">
          {t("verifyRejected")}
        </p>
      )}

      {questions.map((q) => (
        <div key={q.id} className="space-y-1.5">
          <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{q.question_text}</p>
          {q.answer_type === "yesno" ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleAnswerChange(q.id, "yes")}
                className={`flex-1 h-10 rounded-lg text-xs font-black border-2 ${answers[q.id] === "yes" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-zinc-200 text-zinc-500"}`}
              >
                {t("verifyYes")}
              </button>
              <button
                type="button"
                onClick={() => handleAnswerChange(q.id, "no")}
                className={`flex-1 h-10 rounded-lg text-xs font-black border-2 ${answers[q.id] === "no" ? "border-red-500 bg-red-50 text-red-700" : "border-zinc-200 text-zinc-500"}`}
              >
                {t("verifyNo")}
              </button>
            </div>
          ) : (
            <Input
              value={answers[q.id] || ""}
              onChange={(e) => handleAnswerChange(q.id, e.target.value)}
              placeholder={t("verifyAnswerPlaceholder")}
              className="rounded-lg h-10 text-xs font-bold"
            />
          )}
        </div>
      ))}

      <div className="space-y-1.5">
        <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{t("verifyPhoneLabel")}</p>
        <Input
          value={claimantPhone}
          onChange={(e) => setClaimantPhone(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder={t("verifyPhonePlaceholder")}
          inputMode="numeric"
          className="rounded-lg h-10 text-xs font-bold"
        />
      </div>

      <Button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full h-12 rounded-xl font-black text-xs bg-zinc-900 hover:bg-zinc-800 text-white"
      >
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : t("verifySubmit")}
      </Button>
    </div>
  );
}
