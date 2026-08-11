"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useSendNotification } from "@/lib/hooks/use-admin-notify";
import type { NotifyTarget } from "@/lib/services/admin-service";

export function SendNotificationDialog({
  open,
  onOpenChange,
  target,
  targetLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: NotifyTarget;
  targetLabel: string;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const { mutate, isPending } = useSendNotification();

  const handleSend = () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Сарлавҳа ва матни хабарро пур кунед");
      return;
    }
    mutate(
      { title: title.trim(), body: body.trim(), target },
      {
        onSuccess: (result) => {
          toast.success(
            `Хабарнома фиристода шуд: ${result.sent}/${result.recipientCount} қабулкунанда`,
          );
          setTitle("");
          setBody("");
          onOpenChange(false);
        },
        onError: (err: Error) => toast.error(err.message || "Хатогӣ рух дод"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <BellRing className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Фиристодани хабарнома
          </DialogTitle>
          <DialogDescription className="text-sm font-medium pt-1">
            Ба {targetLabel} push-хабарнома фиристода мешавад (танҳо корбароне, ки push-ро фаъол кардаанд, қабул мекунанд).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="notif-title">Сарлавҳа</Label>
            <Input
              id="notif-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Масалан: Хабари муҳим"
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notif-body">Матн</Label>
            <Textarea
              id="notif-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Матни хабарнома..."
              maxLength={200}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending} className="flex-1">
            Бекор кардан
          </Button>
          <Button onClick={handleSend} disabled={isPending} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Фиристодан"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
