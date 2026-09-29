"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PhoneInput } from "@/components/phone-input";
import { COUNTRIES, DEFAULT_COUNTRY, type Country } from "@/lib/countries";
import { VerifiedBadge } from "@/components/verified-badge";
import { useUpdateAdminUser } from "@/lib/hooks/use-admin-users";
import type { AdminUserDetail } from "@/lib/hooks/use-admin-users";

/**
 * Stored phones are mixed: mostly the national number (what the client saves),
 * some "+992…"/"992…" (from Clerk). Split into country + national number so the
 * field shows the country code like the client's PhoneInput.
 */
function splitPhone(raw: string | null | undefined): { country: Country; national: string } {
  const digits = (raw ?? "").replace(/D/g, "");
  if (digits.length > DEFAULT_COUNTRY.nsnLength) {
    const match = COUNTRIES.find(
      (c) => digits.startsWith(c.dialCode) && digits.length === c.dialCode.length + c.nsnLength,
    );
    if (match) return { country: match, national: digits.slice(match.dialCode.length) };
  }
  return { country: DEFAULT_COUNTRY, national: digits };
}

export function UserEditForm({ profile }: { profile: AdminUserDetail["profile"] }) {
  const [initialPhone] = useState(() => splitPhone(profile.phone));
  const [initialSecondary] = useState(() => splitPhone(profile.secondary_phone));
  const [form, setForm] = useState({
    first_name: profile.first_name ?? "",
    last_name: profile.last_name ?? "",
    phone: initialPhone.national,
    secondary_phone: initialSecondary.national,
    email: profile.email ?? "",
    is_verified: profile.is_verified ?? false,
  });
  const { mutate, isPending } = useUpdateAdminUser(profile.id);

  const handleSave = () => {
    // An untouched number is sent back exactly as stored — opening and saving
    // the form must not silently rewrite "+992…" into the national format.
    const payload = {
      ...form,
      phone: form.phone === initialPhone.national ? (profile.phone ?? "") : form.phone,
      secondary_phone:
        form.secondary_phone === initialSecondary.national ? (profile.secondary_phone ?? "") : form.secondary_phone,
    };
    mutate(payload, {
      onSuccess: () => toast.success("Маълумот навсозӣ шуд"),
      onError: (err: Error) => toast.error(err.message || "Хатогӣ рух дод"),
    });
  };

  return (
    <div className="rounded-md border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-800 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Маълумоти профил</h3>

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
          <PhoneInput
            defaultCountryIso2={initialPhone.country.iso2}
            containerClassName="h-11"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Телефони иловагӣ</Label>
          <PhoneInput
            defaultCountryIso2={initialSecondary.country.iso2}
            containerClassName="h-11"
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
