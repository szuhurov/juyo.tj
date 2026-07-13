"use client";

import Link from "next/link";
import { format } from "date-fns";
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

export function UserVerificationClaims({
  sent,
  received,
}: {
  sent: AdminUserDetail["verificationAttempts"];
  received: AdminUserDetail["receivedClaims"];
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-2">
          Дархостҳои фиристодашуда ({sent.length})
        </h3>
        {sent.length === 0 ? (
          <p className="py-8 text-center text-sm font-bold text-zinc-400 rounded-xl border border-zinc-100">
            Ягон дархост нест
          </p>
        ) : (
          <div className="space-y-2">
            {sent.map((attempt) => (
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
        )}
      </div>

      <div>
        <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-2">
          Дархостҳои воридшуда ({received.length})
        </h3>
        {received.length === 0 ? (
          <p className="py-8 text-center text-sm font-bold text-zinc-400 rounded-xl border border-zinc-100">
            Ягон дархост нест
          </p>
        ) : (
          <div className="space-y-2">
            {received.map((claim) => {
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
    </div>
  );
}
