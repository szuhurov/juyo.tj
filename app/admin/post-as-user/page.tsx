"use client";

/**
 * TEMPORARY tool (needed only once) — admin can add a post on behalf of
 * any other user, WITHOUT going through AI moderation (for example when
 * OpenAI is unavailable, or the user writes directly to the admin
 * via Telegram). Instead of AI moderation — the admin's own MANUAL
 * blurring (by dragging with the mouse) to hide sensitive information in
 * photos. Not linked in the sidebar — accessible only via a direct URL.
 */
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { CATEGORIES } from "@/lib/services/item-service";
import { PrivacyBlurEditor } from "@/components/privacy-blur-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2, Search, X, ShieldCheck } from "lucide-react";

interface AdminUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
}

function PostAsUserContent() {
  const searchParams = useSearchParams();
  const presetUserId = searchParams.get("userId");

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [results, setResults] = useState<AdminUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [loadingPreset, setLoadingPreset] = useState(!!presetUserId);

  useEffect(() => {
    if (!presetUserId) return;
    fetch(`/api/admin/users/${presetUserId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.profile) setSelectedUser(data.profile);
      })
      .finally(() => setLoadingPreset(false));
  }, [presetUserId]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Other");
  const [type, setType] = useState<"lost" | "found">("lost");
  const [phone, setPhone] = useState("");
  const [reward, setReward] = useState("");

  const [images, setImages] = useState<File[]>([]);
  const [blurredDone, setBlurredDone] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!debouncedSearch.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    fetch(`/api/admin/users?search=${encodeURIComponent(debouncedSearch)}&pageSize=8`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setResults(data.users ?? []);
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setImages(files);
    setBlurredDone(false);
  }

  function handleBlurConfirm(finalFiles: File[]) {
    setImages(finalFiles);
    setBlurredDone(true);
    setEditorOpen(false);
    toast.success("Мозаика татбиқ шуд");
  }

  async function handleSubmit() {
    if (!selectedUser) return toast.error("Аввал корбарро интихоб кунед");
    if (!title.trim() || !description.trim()) return toast.error("Унвон ва тавсиф ҳатмист");
    if (images.length === 0) return toast.error("Ҳадди ақал як акс ҳатмист");
    if (!blurredDone) {
      const proceed = window.confirm(
        "Шумо мозаика насохтед. Оё мутмаинед, ки дар аксҳо маълумоти ҳассос (рақами шиноснома, чек ва ғ.) нест?",
      );
      if (!proceed) return;
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("user_id", selectedUser.id);
      form.append("title", title.trim());
      form.append("description", description.trim());
      form.append("category", category);
      form.append("type", type);
      form.append("phone_number", phone.trim());
      if (reward.trim()) form.append("reward", reward.trim());
      images.forEach((f) => form.append("image", f));

      const res = await fetch("/api/admin/post-as-user", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Хатогӣ рӯй дод");

      toast.success("Эълон сабт шуд");
      setTitle("");
      setDescription("");
      setPhone("");
      setReward("");
      setImages([]);
      setBlurredDone(false);
      setSelectedUser(null);
      setSearch("");
      setResults([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Хатогӣ рӯй дод");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-xl min-[1084px]:max-w-2xl mx-auto space-y-5 pb-20">
      <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-500/10 p-4 text-xs min-[1084px]:text-sm font-medium text-amber-800 flex gap-2">
        <ShieldCheck className="w-4 h-4 min-[1084px]:w-5 min-[1084px]:h-5 shrink-0 mt-0.5" />
        <span>
          Ин восита санҷиши AI-ро гузаронда мешавад. Ҳимояи махфият ФАҚАТ ба
          мозаикаи дастии шумо вобаста аст — пеш аз сабт ҳатман минтақаҳои
          ҳассосро (рақами шиноснома, чек, корти бонкӣ) бо муш кашида пинҳон
          кунед.
        </span>
      </div>

      {/* User selection */}
      <div className="space-y-2">
        <Label className="text-[10px] tracking-widest text-zinc-400 ml-1">
          КОРБАР
        </Label>
        {loadingPreset ? (
          <Skeleton className="h-12 w-full rounded-md" />
        ) : selectedUser ? (
          <div className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 dark:bg-emerald-500/10 p-3">
            <div className="text-sm font-semibold text-emerald-800">
              {selectedUser.first_name} {selectedUser.last_name}{" "}
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                {selectedUser.phone || selectedUser.email}
              </span>
            </div>
            <button onClick={() => setSelectedUser(null)} type="button">
              <X className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <Input
              placeholder="Ном, телефон ё почта..."
              className="pl-9 rounded-md h-11 min-[1084px]:h-12"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-zinc-400" />}
            {results.length > 0 && (
              <div className="mt-1 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 overflow-hidden">
                {results.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setSelectedUser(u);
                      setResults([]);
                    }}
                    className="w-full text-left px-3 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-800 last:border-0"
                  >
                    <div className="text-sm font-semibold">
                      {u.first_name} {u.last_name}
                    </div>
                    <div className="text-xs text-zinc-400">{u.phone || u.email}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <Label className="text-[10px] tracking-widest text-zinc-400 ml-1">УНВОН</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-md h-11 min-[1084px]:h-12" />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label className="text-[10px] tracking-widest text-zinc-400 ml-1">ТАВСИФ</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="rounded-md min-h-24" />
      </div>

      {/* Category */}
      <div className="space-y-2">
        <Label className="text-[10px] tracking-widest text-zinc-400 ml-1">КАТЕГОРИЯ</Label>
        <div className="grid grid-cols-4 gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.name)}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-md border-2 text-[10px] font-medium",
                category === cat.name ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "border-zinc-100 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300",
              )}
            >
              <span>{cat.icon}</span>
              <span>{cat.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Type */}
      <div className="flex gap-2">
        {(["lost", "found"] as const).map((tp) => (
          <button
            key={tp}
            type="button"
            onClick={() => setType(tp)}
            className={cn(
              "flex-1 h-11 min-[1084px]:h-12 rounded-md border-2 font-medium text-xs min-[1084px]:text-sm",
              type === tp ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "border-zinc-100 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400",
            )}
          >
            {tp === "lost" ? "ГУМШУДА" : "ЁФТШУДА"}
          </button>
        ))}
      </div>

      {/* Phone / reward */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[10px] tracking-widest text-zinc-400 ml-1">ТЕЛЕФОН</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded-md h-11 min-[1084px]:h-12" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] tracking-widest text-zinc-400 ml-1">МУКОФОТ (агар бошад)</Label>
          <Input value={reward} onChange={(e) => setReward(e.target.value)} className="rounded-md h-11 min-[1084px]:h-12" />
        </div>
      </div>

      {/* Photos */}
      <div className="space-y-2">
        <Label className="text-[10px] tracking-widest text-zinc-400 ml-1">АКСҲО</Label>
        <input type="file" accept="image/*" multiple onChange={handleFiles} className="text-xs" />
        {images.length > 0 && (
          <div className="flex items-center justify-between rounded-md border border-zinc-200 dark:border-zinc-800 p-3">
            <span className="text-xs font-medium">
              {images.length} акс {blurredDone ? "— мозаика шуд ✅" : "— мозаика НАШУДААСТ"}
            </span>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditorOpen(true)}>
              Мозаика кардан
            </Button>
          </div>
        )}
      </div>

      <Button
        type="button"
        disabled={submitting}
        onClick={handleSubmit}
        className="w-full h-12 min-[1084px]:h-[52px] rounded-md text-sm min-[1084px]:text-base bg-emerald-500 hover:bg-emerald-600 text-white"
      >
        {submitting ? <Loader2 className="w-4 h-4 min-[1084px]:w-5 min-[1084px]:h-5 animate-spin" /> : "Сабт кардан"}
      </Button>

      <PrivacyBlurEditor
        open={editorOpen}
        files={images}
        initialRegions={[]}
        onConfirm={handleBlurConfirm}
        onCancel={() => setEditorOpen(false)}
      />
    </div>
  );
}

export default function PostAsUserPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 max-w-xl mx-auto rounded-md" />}>
      <PostAsUserContent />
    </Suspense>
  );
}
