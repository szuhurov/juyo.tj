"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { VerifiedBadge } from "@/components/verified-badge";
import { useUpdateAdminUser } from "@/lib/hooks/use-admin-users";
import type { AdminUserDetail } from "@/lib/hooks/use-admin-users";

export function UserEditForm({ profile }: { profile: AdminUserDetail["profile"] }) {
  const [form, setForm] = useState({
    first_name: profile.first_name ?? "",
    last_name: profile.last_name ?? "",
    phone: profile.phone ?? "",
    secondary_phone: profile.secondary_phone ?? "",
    email: profile.email ?? "",
    is_verified: profile.is_verified ?? false,
  });
  const { mutate, isPending } = useUpdateAdminUser(profile.id);

  const handleSave = () => {
    mutate(form, {
      onSuccess: () => toast.success("Маълумот навсозӣ шуд"),
      onError: (err: Error) => toast.error(err.message || "Хатогӣ рух дод"),
    });
  };

  return (
    <div className="rounded-md border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-800 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Маълумоти профил</h3>

      <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-500/10 border border-amber-100 p-3 text-[11px] font-medium text-amber-700 dark:text-amber-400">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        Ном, телефон ва почта аз Clerk синхрон мешаванд — агар корбар профили худро дар барнома нав кунад, тағйироти шумо метавонанд рӯй пӯшонда шаванд.
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Ном</Label>
          <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Насаб</Label>
          <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Телефон</Label>
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Телефони иловагӣ</Label>
          <Input
            value={form.secondary_phone}
            onChange={(e) => setForm({ ...form, secondary_phone: e.target.value })}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Почтаи электронӣ</Label>
          <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
      </div>

      <label className="flex items-center gap-2.5 cursor-pointer w-fit">
        <Checkbox
          checked={form.is_verified}
          onCheckedChange={(checked) => setForm({ ...form, is_verified: checked === true })}
        />
        <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
          Ҳисоби тасдиқшуда <VerifiedBadge />
        </span>
      </label>

      <Button onClick={handleSave} disabled={isPending} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
        {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        Захира кардан
      </Button>
    </div>
  );
}
