"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { CATEGORIES } from "@/lib/services/item-service";
import { useUpdateAdminPost } from "@/lib/hooks/use-admin-posts";
import type { AdminPostDetail } from "@/lib/hooks/use-admin-posts";

export function PostEditForm({ item }: { item: AdminPostDetail["item"] }) {
  const [form, setForm] = useState({
    title: item.title,
    description: item.description ?? "",
    category: item.category,
    type: item.type,
    moderation_status: item.moderation_status,
    is_resolved: item.is_resolved,
    reward: item.reward ?? "",
    phone_number: item.phone_number ?? "",
  });
  const { mutate, isPending } = useUpdateAdminPost(item.id);

  const handleSave = () => {
    mutate(form, {
      onSuccess: () => toast.success("Эълон навсозӣ шуд"),
      onError: (err: Error) => toast.error(err.message || "Хатогӣ рух дод"),
    });
  };

  return (
    <div className="rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-800 p-5 space-y-4">
      <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Таҳрир кардан</h3>

      <div className="space-y-1.5">
        <Label>Сарлавҳа</Label>
        <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </div>

      <div className="space-y-1.5">
        <Label>Тавсиф</Label>
        <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Категория</Label>
          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.id} value={c.name}>{c.icon} {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Намуд</Label>
          <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as "lost" | "found" })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="lost">Гумшуда</SelectItem>
              <SelectItem value="found">Ёфтшуда</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Ҳолати тасдиқ</Label>
          <Select
            value={form.moderation_status}
            onValueChange={(v) => setForm({ ...form, moderation_status: v as "pending" | "approved" | "rejected" })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Дар интизор</SelectItem>
              <SelectItem value="approved">Тасдиқшуда</SelectItem>
              <SelectItem value="rejected">Рад шуда</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Мукофот</Label>
          <Input value={form.reward} onChange={(e) => setForm({ ...form, reward: e.target.value })} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Рақами телефон</Label>
          <Input value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} />
        </div>
      </div>

      <label className="flex items-center gap-2.5 cursor-pointer w-fit">
        <Checkbox
          checked={form.is_resolved}
          onCheckedChange={(checked) => setForm({ ...form, is_resolved: checked === true })}
        />
        <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Ҳалшуда ҳисоб карда шавад</span>
      </label>

      <Button onClick={handleSave} disabled={isPending} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
        {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        Захира кардан
      </Button>
    </div>
  );
}
