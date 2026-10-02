"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { Ban, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/language-context";
import { createClerkSupabaseClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { REPORT_REASONS, type ReportReason, reportItem, blockUser } from "@/lib/services/safety-service";

const REASON_KEY: Record<ReportReason, string> = {
  spam: "reportReasonSpam",
  scam: "reportReasonScam",
  offensive: "reportReasonOffensive",
  personal_info: "reportReasonPersonalInfo",
  fake: "reportReasonFake",
  other: "reportReasonOther",
};

/**
 * Report a listing and/or block its poster. Mirrors the mobile
 * `components/ReportSheet.tsx`. Reports go to Admin → Reports; three distinct
 * reporters hide the listing until an admin decides. Blocking hides the
 * poster's listings for this user only.
 */
export function ReportDialog({
  open,
  onOpenChange,
  itemId,
  ownerId,
  onBlocked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  ownerId: string;
  onBlocked: () => void;
}) {
  const { t } = useLanguage();
  const { userId, getToken } = useAuth();
  const qc = useQueryClient();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [blocking, setBlocking] = useState(false);

  const reset = () => {
    setReason(null);
    setDetails("");
  };

  const submit = async () => {
    if (!reason || !userId || sending) return;
    setSending(true);
    try {
      const result = await reportItem(createClerkSupabaseClient(getToken), userId, itemId, reason, details);
      toast.success(t(result === "already" ? "reportAlreadySent" : "reportSent"));
      reset();
      onOpenChange(false);
    } catch {
      toast.error(t("error"));
    } finally {
      setSending(false);
    }
  };

  const block = async () => {
    if (!userId || blocking) return;
    setBlocking(true);
    try {
      await blockUser(createClerkSupabaseClient(getToken), userId, ownerId);
      await qc.invalidateQueries({ queryKey: ["blocked-ids", userId] });
      qc.invalidateQueries({ queryKey: ["blocked-users", userId] });
      toast.success(t("userBlocked"));
      setConfirmBlock(false);
      onOpenChange(false);
      onBlocked();
    } catch {
      toast.error(t("error"));
    } finally {
      setBlocking(false);
    }
  };

  return (
    <>
      <Dialog
        open={open && !confirmBlock}
        onOpenChange={(o) => {
          if (sending) return;
          if (!o) reset();
          onOpenChange(o);
        }}
      >
        <DialogContent className="rounded-md border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle>{t("reportTitle")}</DialogTitle>
            <DialogDescription>{t("reportDesc")}</DialogDescription>
          </DialogHeader>

          <div role="radiogroup" className="space-y-2">
            {REPORT_REASONS.map((r) => {
              const on = reason === r;
              return (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setReason(r)}
                  className={cn(
                    "pressable w-full min-h-12 px-4 rounded-md border flex items-center justify-between text-left text-sm",
                    on
                      ? "border-emerald-500 font-semibold text-zinc-900 dark:text-white"
                      : "border-hairline dark:border-zinc-700 font-medium text-zinc-800 dark:text-zinc-200",
                  )}
                >
                  {t(REASON_KEY[r])}
                  {on && <Check className="w-4 h-4 text-emerald-500" />}
                </button>
              );
            })}
          </div>

          <Textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder={t("reportDetailsPlaceholder")}
            aria-label={t("reportDetailsPlaceholder")}
            maxLength={1000}
            className="min-h-[88px]"
          />

          <Button
            onClick={submit}
            disabled={!reason || sending}
            className="h-12 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : t("reportSend")}
          </Button>

          {ownerId !== userId && (
            <button
              type="button"
              onClick={() => setConfirmBlock(true)}
              className="w-full flex items-center gap-3 py-2 text-left"
            >
              <Ban className="w-[18px] h-[18px] text-red-600 shrink-0" />
              <span className="flex-1">
                <span className="block text-sm font-semibold text-red-600">{t("blockUser")}</span>
                <span className="block text-xs text-zinc-500 dark:text-zinc-400">{t("blockUserHint")}</span>
              </span>
            </button>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmBlock}
        onOpenChange={(o) => !blocking && setConfirmBlock(o)}
        title={t("blockConfirmTitle")}
        description={t("blockConfirmDesc")}
        icon={Ban}
        variant="destructive"
        confirmLabel={t("blockUser")}
        cancelLabel={t("cancel")}
        onConfirm={block}
        loading={blocking}
      />
    </>
  );
}
