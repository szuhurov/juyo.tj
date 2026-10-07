"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, CheckCheck, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useBulkApprovePosts, useSafePosts, type SafePost } from "@/lib/hooks/use-admin-posts";
import { NOT_CHECKED_BY_AI } from "@/lib/image-moderation";
import { VISUAL_MODEL } from "@/lib/visual-model";
import { embedPhotoUrl } from "@/lib/visual-search";

/**
 * The "safe" list: pending listings whose every photo the weapons model
 * scored SAFE. The model only sorts; the admin looks at every photo here and
 * approves. Before a listing can be approved, THIS browser recomputes the
 * vectors of its photos (the poster's own vector is not trusted) and the
 * database re-scores them; a listing that turns out not to be safe leaves
 * this list and stays in the normal queue.
 */
export default function SafePostsPage() {
  const { data, isLoading, isError, refetch } = useSafePosts();
  const approve = useBulkApprovePosts();
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [checking, setChecking] = useState<{ done: number; total: number } | null>(null);
  const tried = useRef(new Set<string>());

  const posts = useMemo(() => data?.posts ?? [], [data]);
  const ready = posts.filter((p) => p.admin_checked);
  const selected = ready.filter((p) => !unchecked.has(p.id));

  // Recompute vectors for listings scored only from the poster's device.
  useEffect(() => {
    const todo = posts.filter((p) => !p.admin_checked && !tried.current.has(p.id));
    if (!todo.length) return;
    let cancelled = false;
    (async () => {
      setChecking({ done: 0, total: todo.length });
      for (const [k, post] of todo.entries()) {
        if (cancelled) return;
        tried.current.add(post.id);
        try {
          const images = [];
          for (const img of post.images) {
            const e = await embedPhotoUrl(img.image_url);
            images.push({ image_id: img.id, vector: e.vector, phash: e.phash });
          }
          await fetch(`/api/admin/posts/${post.id}/embeddings`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ model: VISUAL_MODEL.id, images }),
          });
        } catch {
          // stays "not checked" and simply cannot be bulk-approved
        }
        if (!cancelled) setChecking({ done: k + 1, total: todo.length });
      }
      if (!cancelled) {
        setChecking(null);
        refetch();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [posts, refetch]);

  const toggle = (id: string) =>
    setUnchecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const doApprove = async () => {
    try {
      const res = await approve.mutateAsync(selected.map((p) => ({ id: p.id, updated_at: p.updated_at })));
      const skipped = selected.length - res.approved.length;
      toast.success(`Тасдиқ шуд: ${res.approved.length}` + (skipped ? ` · ${skipped} эълон тағйир ёфт ва дар навбат монд` : ""));
      setConfirmOpen(false);
      setUnchecked(new Set());
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Хатогӣ");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/posts?moderation_status=pending" className="text-zinc-400 hover:text-zinc-700">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" /> Бехатар (AI)
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Модел дар ин эълонҳо силоҳ ва корд наёфт. Ҳар аксро бинед ва тасдиқ кунед. {NOT_CHECKED_BY_AI}
            </p>
          </div>
        </div>
        <Button disabled={!selected.length || approve.isPending} onClick={() => setConfirmOpen(true)} className="gap-2">
          <CheckCheck className="w-4 h-4" />
          Ҳамаро тасдиқ кун ({selected.length})
        </Button>
      </div>

      {checking && (
        <p className="flex items-center gap-2 text-xs text-zinc-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Аксҳо дар ҳамин браузер аз нав санҷида мешаванд: {checking.done}/{checking.total}
        </p>
      )}

      {isError ? (
        <p className="py-16 text-center text-sm font-semibold text-rose-500">Хатогӣ ҳангоми боркунӣ</p>
      ) : isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-56" />)}
        </div>
      ) : posts.length === 0 ? (
        <p className="py-16 text-center text-sm font-semibold text-zinc-400">Ҳоло эълони бехатар дар навбат нест</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {posts.map((p) => (
            <SafeCard key={p.id} post={p} selected={p.admin_checked && !unchecked.has(p.id)} onToggle={() => toggle(p.id)} />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        icon={CheckCheck}
        title={`${selected.length} эълонро тасдиқ мекунед?`}
        description="Онҳо дарҳол нашр мешаванд. Эълоне, ки баъди кушодани ин рӯйхат тағйир ёфтааст, тасдиқ намешавад ва дар навбат мемонад."
        confirmLabel="Тасдиқ"
        cancelLabel="Бекор"
        loading={approve.isPending}
        onConfirm={doApprove}
      />
    </div>
  );
}

function SafeCard({ post, selected, onToggle }: { post: SafePost; selected: boolean; onToggle: () => void }) {
  return (
    <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 space-y-2">
      <div className="flex items-start gap-3">
        <Checkbox checked={selected} disabled={!post.admin_checked} onCheckedChange={onToggle} className="mt-1" />
        <div className="min-w-0 flex-1">
          <Link href={`/admin/posts/${post.id}`} className="font-semibold text-zinc-900 dark:text-white hover:underline line-clamp-1">
            {post.title}
          </Link>
          <p className="text-[11px] text-zinc-500">
            {post.category} · {post.type === "lost" ? "Гумшуда" : "Ёфтшуда"}
            {!post.admin_checked && " · санҷиш дар браузер…"}
          </p>
          {post.description && <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 mt-1">{post.description}</p>}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {post.images.map((img) => (
          <div key={img.id} className="aspect-square rounded-md overflow-hidden bg-zinc-100 dark:bg-zinc-800">
            <Image src={img.image_url} alt={post.title} width={220} height={220} className="object-cover w-full h-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
