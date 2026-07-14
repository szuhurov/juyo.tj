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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Phone, ShieldQuestion, Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";

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
}: {
  itemId: string;
  isOwner: boolean;
  phoneNumber?: string | null;
}) {
  const { t } = useLanguage();
  const { userId, getToken } = useAuth();

  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"none" | "pending_review" | "passed" | "rejected">("none");
  const [phone, setPhone] = useState<string | null>(null);
  const [showCallConfirm, setShowCallConfirm] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [claimantPhone, setClaimantPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Owner-review state
  const [pendingAttempts, setPendingAttempts] = useState<Attempt[] | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

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

  const handleReview = async (attemptId: string, approve: boolean) => {
    setReviewingId(attemptId);
    try {
      const token = await getToken({ template: "supabase" });
      if (!token) return;
      const supabase = createClerkSupabaseClient(token);
      const { error } = await supabase.rpc("review_verification_attempt", {
        p_attempt_id: attemptId,
        p_approve: approve,
      });
      if (error) throw error;
      setPendingAttempts((prev) => (prev ?? []).filter((a) => a.id !== attemptId));
      toast.success(approve ? t("verifyApprove") : t("verifyReject"));
    } catch (e: any) {
      toast.error(e.message || t("error"));
    } finally {
      setReviewingId(null);
    }
  };

  if (loading) {
    return (
      <Button size="lg" disabled className="h-14 md:h-16 w-full rounded-2xl font-black bg-zinc-200 text-zinc-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </Button>
    );
  }

  // Owner: show a pending-review card above the normal action buttons (item-details-client renders Resolved separately).
  if (isOwner) {
    if (!pendingAttempts || pendingAttempts.length === 0) return null;
    return (
      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-black text-xs uppercase tracking-wider">
          <ShieldQuestion className="w-4 h-4" />
          {t("verifyPendingCount").replace("%{count}", String(pendingAttempts.length))}
        </div>
        {pendingAttempts.map((attempt) => (
          <div key={attempt.id} className="bg-white dark:bg-zinc-900 rounded-xl p-4 space-y-2 border border-zinc-100 dark:border-zinc-800">
            {attempt.claimant_phone && (
              <div className="text-xs pb-2 mb-1 border-b border-zinc-100 dark:border-zinc-800">
                <p className="font-bold text-zinc-500">{t("verifyClaimantPhoneLabel")}</p>
                <a href={`tel:${attempt.claimant_phone}`} className="font-black text-zinc-900 dark:text-zinc-100">
                  {attempt.claimant_phone}
                </a>
                {attempt.matched_user_id && (
                  <p className="mt-1 flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold">
                    <ShieldQuestion className="w-3.5 h-3.5 shrink-0" />
                    {t("verifyMatchedAccount").replace(
                      "%{name}",
                      `${attempt.matched_first_name ?? ""} ${attempt.matched_last_name ?? ""}`.trim() || attempt.matched_user_id,
                    )}
                  </p>
                )}
              </div>
            )}
            {attempt.answers.map((a) => (
              <div key={a.question_id} className="text-xs">
                <p className="font-bold text-zinc-500">{a.question_text}</p>
                <p className="font-black text-zinc-900 dark:text-zinc-100">
                  {a.answer_type === "yesno" ? (a.given_answer === "yes" ? t("verifyYes") : t("verifyNo")) : a.given_answer}
                </p>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                disabled={reviewingId === attempt.id}
                onClick={() => handleReview(attempt.id, true)}
                className="flex-1 h-9 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[10px] uppercase tracking-wider"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> {t("verifyApprove")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={reviewingId === attempt.id}
                onClick={() => handleReview(attempt.id, false)}
                className="flex-1 h-9 rounded-lg border-red-200 text-red-600 hover:bg-red-50 font-black text-[10px] uppercase tracking-wider"
              >
                <XCircle className="w-3.5 h-3.5 mr-1" /> {t("verifyReject")}
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Claimant, no questions configured — warn that the finder may still ask
  // their own questions verbally, and require confirmation before calling.
  if (!questions || questions.length === 0) {
    return (
      <>
        <Button
          size="lg"
          onClick={() => setShowCallConfirm(true)}
          className="h-14 md:h-16 w-full rounded-2xl font-black bg-zinc-900 hover:bg-zinc-800 text-white shadow-lg"
        >
          <Phone className="w-5 h-5 md:w-6 md:h-6 mr-2" /> {t("call")}
        </Button>
        <Dialog open={showCallConfirm} onOpenChange={setShowCallConfirm}>
          <DialogContent className="sm:max-w-md rounded-[2rem]">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">
                {t("verifyNoQuestionsCallTitle")}
              </DialogTitle>
              <DialogDescription className="text-sm font-medium leading-relaxed pt-2">
                {t("verifyNoQuestionsCallDesc")}
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2.5 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowCallConfirm(false)}
                className="flex-1 h-12 rounded-xl font-bold text-xs"
              >
                {t("verifyNo")}
              </Button>
              <Button
                asChild
                onClick={() => setShowCallConfirm(false)}
                className="flex-1 h-12 rounded-xl font-black text-xs bg-zinc-900 hover:bg-zinc-800 text-white"
              >
                <a href={`tel:${phoneNumber}`}>{t("verifyYes")}</a>
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
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
      <div className="h-14 md:h-16 w-full rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center gap-2 text-amber-700 font-bold text-sm px-4 text-center">
        <Clock className="w-5 h-5 shrink-0" /> {t("verifyPendingReview")}
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
