import { format } from "date-fns";
import { StatusPill } from "@/components/admin/status-pill";
import type { AdminPostDetail } from "@/lib/hooks/use-admin-posts";

export function PostVerificationAttempts({ attempts }: { attempts: AdminPostDetail["verificationAttempts"] }) {
  if (attempts.length === 0) return null;

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-black text-zinc-900 mb-3">
        Кӯшишҳои даъвои моликият ({attempts.length})
      </h3>
      <div className="space-y-3">
        {attempts.map((attempt) => (
          <div key={attempt.id} className="rounded-xl border border-zinc-100 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-zinc-400">
                {format(new Date(attempt.created_at), "d MMM yyyy, HH:mm")}
              </p>
              <StatusPill status={attempt.status} />
            </div>
            {attempt.answers.map((a, i) => (
              <div key={i} className="text-xs">
                <p className="font-bold text-zinc-500">{a.question_text}</p>
                <p className="font-bold text-zinc-800">{a.given_answer}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
