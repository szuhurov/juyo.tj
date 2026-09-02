"use client";

import * as React from "react";
import { Loader2, type LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: LucideIcon;
  variant?: "default" | "destructive";
  confirmLabel: React.ReactNode;
  /** Omit for a single-button "acknowledge" dialog. */
  cancelLabel?: React.ReactNode;
  onConfirm: () => void;
  loading?: boolean;
  children?: React.ReactNode;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  icon: Icon,
  variant = "default",
  confirmLabel,
  cancelLabel,
  onConfirm,
  loading = false,
  children,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !loading && onOpenChange(next)}
    >
      <DialogContent className="w-[96%] sm:max-w-md rounded-3xl p-8 border-none shadow-2xl bg-white dark:bg-zinc-950">
        <DialogHeader className="space-y-4 text-center">
          {Icon && (
            <div
              className={cn(
                "w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-2",
                variant === "destructive"
                  ? "bg-red-50 dark:bg-red-900/20"
                  : "bg-emerald-50 dark:bg-emerald-900/20",
              )}
            >
              <Icon
                className={cn(
                  "w-8 h-8",
                  variant === "destructive" ? "text-red-500" : "text-emerald-500",
                )}
              />
            </div>
          )}
          <DialogTitle className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 leading-tight">
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription className="text-zinc-500 dark:text-zinc-400 font-bold text-sm leading-relaxed">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        {children && <div className="mt-2">{children}</div>}
        <div className="mt-6 flex flex-col gap-3">
          <Button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              "w-full h-12 rounded-xl font-bold tracking-widest text-[11px]",
              variant === "destructive"
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-emerald-500 hover:bg-emerald-600 text-white",
            )}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              confirmLabel
            )}
          </Button>
          {cancelLabel && (
            <Button
              type="button"
              variant="ghost"
              disabled={loading}
              onClick={() => onOpenChange(false)}
              className="w-full h-11 rounded-xl font-bold tracking-widest text-[10px] text-zinc-500"
            >
              {cancelLabel}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
