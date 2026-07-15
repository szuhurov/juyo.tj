"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { StatusPill } from "@/components/admin/status-pill";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import type { AdminUserDetail } from "@/lib/hooks/use-admin-users";

function AnswersList({ answers }: { answers: AdminUserDetail["verificationAttempts"][number]["answers"] }) {
  if (!answers || answers.length === 0) return null;
  return (
    <div className="mt-2 space-y-1 border-t border-zinc-100 pt-2">
      {answers.map((a) => (
        <p key={a.question_id} className="text-xs text-zinc-600">
          <span className="font-bold text-zinc-500">{a.question_text}:</span>{" "}
          <span className="font-medium">{a.given_answer}</span>
        </p>
      ))}
    </div>
  );
}

type SubTab = "sent" | "received";
type StatusFilter = "active" | "deleted";

export function UserVerificationClaims({
  sent,
  received,
}: {
  sent: AdminUserDetail["verificationAttempts"];
  received: AdminUserDetail["receivedClaims"];
}) {
  const [subTab, setSubTab] = useState<SubTab>("sent");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");

  const sentFiltered = sent.filter((a) => (statusFilter === "deleted" ? a.is_deleted : !a.is_deleted));
  const receivedFiltered = received.filter((a) => (statusFilter === "deleted" ? a.is_deleted : !a.is_deleted));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-8 border-b border-zinc-100">
          <button
            type="button"
            onClick={() => setSubTab("sent")}
            className={cn(
              "text-sm font-bold pb-2 border-b-2 transition-colors",
              subTab === "sent"
                ? "text-zinc-900 border-blue-600"
                : "text-zinc-400 border-transparent hover:text-zinc-600",
            )}
          >
            Огоҳиномаҳои фиристодашуда ({sent.filter((a) => !a.is_deleted).length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab("received")}
            className={cn(
              "text-sm font-bold pb-2 border-b-2 transition-colors",
              subTab === "received"
                ? "text-zinc-900 border-blue-600"
                : "text-zinc-400 border-transparent hover:text-zinc-600",
            )}
          >
            Огоҳиномаҳои воридшуда ({received.filter((a) => !a.is_deleted).length})
          </button>
        </div>

        <div className="flex items-center gap-1.5 rounded-full bg-zinc-50 p-1">
          <button
            type="button"
            onClick={() => setStatusFilter("active")}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-bold transition-colors",
              statusFilter === "active" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-600",
            )}
          >
            Фаъол
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("deleted")}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-bold transition-colors",
              statusFilter === "deleted" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-600",
            )}
          >
            Нестшуда
          </button>
        </div>
      </div>

      {subTab === "sent" ? (
        sentFiltered.length === 0 ? (
          <p className="py-8 text-center text-sm font-bold text-zinc-400 rounded-xl border border-zinc-100">
            {statusFilter === "deleted" ? "Ягон огоҳиномаи нестшуда нест" : "Ягон огоҳинома нест"}
          </p>
        ) : (
          <div className="space-y-2">
            {sentFiltered.map((attempt) => (
              <div key={attempt.id} className="rounded-xl border border-zinc-100 p-3">
                <div className="flex items-center justify-between gap-3">
                  <Link
                    href={`/admin/posts/${attempt.item_id}`}
                    className="font-bold text-zinc-800 hover:text-blue-600 hover:underline truncate"
                  >
                    {attempt.items?.title ?? "Эълон"}
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-medium text-zinc-400">
                      {format(new Date(attempt.created_at), "d MMM yyyy, HH:mm")}
                    </span>
                    <StatusPill status={attempt.status} />
                  </div>
                </div>
                <AnswersList answers={attempt.answers} />
              </div>
            ))}
          </div>
        )
      ) : receivedFiltered.length === 0 ? (
        <p className="py-8 text-center text-sm font-bold text-zinc-400 rounded-xl border border-zinc-100">
          {statusFilter === "deleted" ? "Ягон огоҳиномаи нестшуда нест" : "Ягон огоҳинома нест"}
        </p>
      ) : (
        <div className="space-y-2">
          {receivedFiltered.map((claim) => {
            const claimantName = claim.claimantProfile
              ? `${claim.claimantProfile.first_name ?? ""} ${claim.claimantProfile.last_name ?? ""}`.trim() || "Беном корбар"
              : "Меҳмон (беном)";
            return (
              <div key={claim.id} className="rounded-xl border border-zinc-100 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar className="w-6 h-6 border border-zinc-100 shrink-0">
                      <AvatarImage src={claim.claimantProfile?.avatar_url ?? undefined} alt={claimantName} />
                      <AvatarFallback className="bg-blue-50 text-blue-600 text-[10px] font-bold">
                        {claimantName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      {claim.claimantProfile ? (
                        <Link
                          href={`/admin/users/${claim.claimant_token}`}
                          className="font-bold text-zinc-800 hover:text-blue-600 hover:underline truncate block"
                        >
                          {claimantName}
                        </Link>
                      ) : (
                        <span className="font-bold text-zinc-800 truncate block">{claimantName}</span>
                      )}
                      <Link
                        href={`/admin/posts/${claim.item_id}`}
                        className="text-[11px] font-medium text-zinc-400 hover:text-blue-600 hover:underline truncate block"
                      >
                        {claim.items?.title ?? "Эълон"}
                      </Link>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-medium text-zinc-400">
                      {format(new Date(claim.created_at), "d MMM yyyy, HH:mm")}
                    </span>
                    <StatusPill status={claim.status} />
                  </div>
                </div>
                {claim.claimant_phone && (
                  <p className="mt-1.5 text-[11px] font-medium text-zinc-400">Тел: {claim.claimant_phone}</p>
                )}
                <AnswersList answers={claim.answers} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
