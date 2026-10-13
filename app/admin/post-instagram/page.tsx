"use client";

/**
 * Admin: publish a listing for a person who wrote to JUYO on Instagram.
 * One page, top to bottom, so a request can be typed in quickly. The listing
 * shows "Аз Instagram-и juyo" with the person's name under it and is approved
 * at once (app/api/admin/post-instagram).
 */
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { ImagePlus, Loader2, ShieldCheck, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PhoneInput } from "@/components/phone-input";
import { TelegramIcon, WhatsappIcon } from "@/components/social-icons";
import { useLanguage } from "@/lib/language-context";
import { cn } from "@/lib/utils";
import { CATEGORIES, UNSPECIFIED_REWARD } from "@/lib/services/item-service";
import { CITY_IDS, cityLabel } from "@/lib/cities";
import { createClerkSupabaseClient } from "@/lib/supabase";
import { uploadListingPhoto } from "@/lib/listing-photo-upload";
import { isNoPhotoCategory, placeholderImageUrl } from "@/lib/photo-policy";
import { isHiddenPhotoFile } from "@/lib/hidden-photo";
import { withOwnerLine, OWNER_ADDRESS_MAX } from "@/lib/document-owner";
import { INSTAGRAM_PROFILE_NAME } from "@/lib/instagram-source";

const PrivacyBlurEditor = dynamic(() =>
  import("@/components/privacy-blur-editor").then((m) => m.PrivacyBlurEditor),
);

const LOCATION_TYPES = [
  "taxi", "airport", "hotel_restaurant", "public_place", "gym",
  "university", "mall", "office", "tourism", "bank",
] as const;
const MAX_PHOTOS = 4;
const today = () => new Date().toISOString().split("T")[0];

const FIELD = "rounded-md h-11 bg-white dark:bg-zinc-800";
const CHIP = "shrink-0 h-9 px-3.5 rounded-md text-sm font-semibold cursor-pointer transition-colors";
const chip = (on: boolean) =>
  cn(CHIP, on ? "bg-emerald-500 text-white" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200");

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-md border border-zinc-200 dark:border-zinc-800 p-4">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

export default function PostInstagramPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const { getToken } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [telegram, setTelegram] = useState(false);
  const [whatsapp, setWhatsapp] = useState(false);
  const [type, setType] = useState<"lost" | "found" | null>(null);
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerAddress, setOwnerAddress] = useState("");
  const [city, setCity] = useState<string | null>(null);
  const [locationType, setLocationType] = useState<string | null>(null);
  const [date, setDate] = useState(today);
  const [reward, setReward] = useState("");
  const [rewardUnspecified, setRewardUnspecified] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const noPhoto = isNoPhotoCategory(category);

  useEffect(() => {
    const urls = photos.map((f) => (isHiddenPhotoFile(f) ? placeholderImageUrl("Documents") : URL.createObjectURL(f)));
    setPreviews(urls);
    return () => urls.forEach((u) => { if (u.startsWith("blob:")) URL.revokeObjectURL(u); });
  }, [photos]);

  const addPhotos = (files: File[]) => {
    if (photos.length + files.length > MAX_PHOTOS) {
      toast.error(`На зиёда аз ${MAX_PHOTOS} акс`);
      return;
    }
    setPhotos((prev) => [...prev, ...files]);
  };

  const submit = async () => {
    if (!firstName.trim() || !lastName.trim()) return toast.error("Ном ва насаби шахсро нависед");
    if (phone.replace(/\D/g, "").length < 7) return toast.error("Рақами телефонро нависед");
    if (!type) return toast.error("Гумшуда ё ёфтшударо интихоб кунед");
    if (!category) return toast.error("Категорияро интихоб кунед");
    if (!title.trim() || !description.trim()) return toast.error("Сарлавҳа ва тавсифро нависед");
    if (!city) return toast.error("Шаҳрро интихоб кунед");
    // Owner decision 2026-10-13: here the admin may write the owner's full name
    // (the public forms still take only "first name + initial").
    const owner = noPhoto ? ownerName.replace(/\s+/g, " ").trim().slice(0, 60) : "";

    setSaving(true);
    try {
      // Same path as a normal listing: re-encoded in this browser (no EXIF/GPS), with a small copy for cards.
      const images: { url: string; thumb: string | null }[] = [];
      if (!noPhoto) {
        const supabase = createClerkSupabaseClient(getToken);
        for (const file of photos) {
          if (isHiddenPhotoFile(file)) {
            const placeholder = placeholderImageUrl("Documents");
            images.push({ url: placeholder, thumb: placeholder });
            continue;
          }
          const uploaded = await uploadListingPhoto(supabase, file);
          images.push({ url: uploaded.url, thumb: uploaded.thumbUrl });
        }
      }

      const res = await fetch("/api/admin/post-instagram", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          phone,
          contact_telegram: telegram,
          contact_whatsapp: whatsapp,
          type,
          category,
          title,
          description: withOwnerLine(description, owner || null, "tg", category === "Documents" ? ownerAddress : null),
          city,
          location_type: locationType,
          date,
          reward: type === "lost" ? (rewardUnspecified ? UNSPECIFIED_REWARD : reward) : "",
          images,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Хатогӣ рух дод");
      toast.success("Эълон гузошта шуд");
      // The listing's admin page computes its search-by-photo vectors.
      router.push(`/admin/posts/${data.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Хатогӣ рух дод");
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 pb-10">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Эълон аз Instagram</h1>
        <p className="text-sm text-zinc-500">
          Барои одамоне, ки дар Instagram хоҳиш кардаанд. Эълон дарҳол нашр мешавад.
        </p>
      </div>

      <Section title="Шахс">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Ном">
            <Input className={FIELD} value={firstName} maxLength={40} onChange={(e) => setFirstName(e.target.value)} />
          </Field>
          <Field label="Насаб">
            <Input className={FIELD} value={lastName} maxLength={40} onChange={(e) => setLastName(e.target.value)} />
          </Field>
        </div>
        <Field label="Рақами телефон">
          <PhoneInput
            containerClassName="bg-white dark:bg-zinc-800 border border-hairline dark:border-zinc-700"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={telegram} onCheckedChange={(v) => setTelegram(v === true)} />
            <TelegramIcon size={18} /> Telegram
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={whatsapp} onCheckedChange={(v) => setWhatsapp(v === true)} />
            <WhatsappIcon size={18} /> WhatsApp
          </label>
        </div>
        {/* Exactly what visitors will see on the listing. */}
        <div className="rounded-md bg-zinc-50 dark:bg-zinc-800/60 px-3 py-2">
          <p className="text-[11px] font-semibold text-zinc-500">Дар эълон чунин дида мешавад</p>
          <p className="text-sm font-semibold">{INSTAGRAM_PROFILE_NAME}</p>
          <p className="text-xs text-zinc-500">{`${firstName} ${lastName}`.trim() || "Ном Насаб"}</p>
        </div>
      </Section>

      <Section title="Эълон">
        <div className="flex gap-2">
          <button type="button" aria-pressed={type === "lost"} onClick={() => setType("lost")} className={chip(type === "lost")}>
            {t("lost")}
          </button>
          <button type="button" aria-pressed={type === "found"} onClick={() => setType("found")} className={chip(type === "found")}>
            {t("found")}
          </button>
        </div>
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-zinc-500">Категория</span>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button key={c.id} type="button" aria-pressed={category === c.name} onClick={() => setCategory(c.name)} className={chip(category === c.name)}>
                {c.icon} {t(`categories.${c.id}`)}
              </button>
            ))}
          </div>
        </div>
        <Field label="Сарлавҳа">
          <Input className={FIELD} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        {noPhoto && (
          <Field label={t(category === "Cards" ? "cardOwnerLabel" : "docOwnerLabel")}>
            <Input className={FIELD} value={ownerName} maxLength={60} placeholder="Масалан: Алишер Раҳимов" autoComplete="off" onChange={(e) => setOwnerName(e.target.value)} />
          </Field>
        )}
        {category === "Documents" && (
          <div className="space-y-1">
            <Field label={t("docAddressLabel")}>
              <Input className={FIELD} value={ownerAddress} maxLength={OWNER_ADDRESS_MAX} placeholder={t("docAddressPlaceholder")} autoComplete="off" onChange={(e) => setOwnerAddress(e.target.value)} />
            </Field>
            <p className="text-xs text-zinc-500">{t("docAddressHint")}</p>
          </div>
        )}
        <Field label="Тавсиф">
          <Textarea className="rounded-md min-h-[110px] bg-white dark:bg-zinc-800 resize-none" value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Сана">
            <Input type="date" className={FIELD} value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          </Field>
          {type === "lost" && (
            <Field label="Мукофот (TJS, ихтиёрӣ)">
              <Input
                className={FIELD}
                inputMode="numeric"
                disabled={rewardUnspecified}
                value={reward}
                onChange={(e) => setReward(e.target.value.replace(/[^0-9]/g, "").replace(/^0+/, "").slice(0, 4))}
              />
            </Field>
          )}
        </div>
        {type === "lost" && !reward && (
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={rewardUnspecified} onCheckedChange={(v) => setRewardUnspecified(v === true)} />
            {t("reward_gives")}
          </label>
        )}
      </Section>

      <Section title="Ҷой">
        <div className="flex flex-wrap gap-2">
          {CITY_IDS.map((id) => (
            <button key={id} type="button" aria-pressed={city === id} onClick={() => setCity(id)} className={chip(city === id)}>
              {cityLabel(id, "tg")}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {LOCATION_TYPES.map((value) => (
            <button key={value} type="button" aria-pressed={locationType === value} onClick={() => setLocationType(locationType === value ? null : value)} className={chip(locationType === value)}>
              {t(`addItemLocationStep.${value}`)}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Аксҳо">
        {noPhoto ? (
          <p className="text-sm text-zinc-500">
            Акси ҳуҷҷат ё корт ҳеҷ гоҳ бор намешавад — дар эълон расми juyo нишон дода мешавад.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {previews.map((src, i) => (
                <div key={src} className="relative aspect-square overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800">
                  <Image src={src} alt="" fill unoptimized className="object-cover" />
                  <button
                    type="button"
                    aria-label="Нест кардан"
                    onClick={() => setPhotos((prev) => prev.filter((_, k) => k !== i))}
                    className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-black/60 text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-zinc-300 dark:border-zinc-700 text-xs font-semibold text-zinc-500"
                >
                  <ImagePlus className="h-6 w-6" />
                  Акс илова кардан
                </button>
              )}
            </div>
            {photos.length > 0 && (
              <Button type="button" variant="outline" className="rounded-md" onClick={() => setEditorOpen(true)}>
                <ShieldCheck className="mr-2 h-4 w-4" />
                Пӯшонидани рақам, ном ё чеҳра
              </Button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                addPhotos(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
          </>
        )}
      </Section>

      <Button type="button" onClick={submit} disabled={saving} className="h-12 w-full rounded-md bg-emerald-500 hover:bg-emerald-600 text-white font-semibold">
        {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Нашр кардан"}
      </Button>

      {editorOpen && (
        <PrivacyBlurEditor
          open
          files={photos}
          onConfirm={(files) => {
            setPhotos(files);
            setEditorOpen(false);
          }}
          onCancel={() => setEditorOpen(false)}
        />
      )}
    </div>
  );
}
