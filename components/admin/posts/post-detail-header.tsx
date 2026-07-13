"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { Trash2, Package, Eye, RotateCcw, FlameKindling } from "lucide-react";
import { StatusPill } from "@/components/admin/status-pill";
import { DeleteConfirmDialog } from "@/components/admin/delete-confirm-dialog";
import { Button } from "@/components/ui/button";
import { useDeleteAdminPost, useUpdateAdminPost, usePermanentlyDeletePost } from "@/lib/hooks/use-admin-posts";
import type { AdminPostDetail } from "@/lib/hooks/use-admin-posts";

export function PostDetailHeader({ item }: { item: AdminPostDetail["item"] }) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [permanentDeleteOpen, setPermanentDeleteOpen] = useState(false);
  const { mutate: deletePost, isPending } = useDeleteAdminPost();
  const { mutate: updatePost, isPending: restoring } = useUpdateAdminPost(item.id);
  const { mutate: permanentlyDeletePost, isPending: permanentlyDeleting } = usePermanentlyDeletePost();
  const ownerName = `${item.profiles?.first_name ?? ""} ${item.profiles?.last_name ?? ""}`.trim() || "—";
  const isDeleted = item.status === "deleted";

  const handleDelete = () => {
    deletePost(item.id, {
      onSuccess: () => {
        toast.success("Эълон нест карда шуд");
        router.push("/admin/posts");
      },
      onError: (err: any) => toast.error(err.message || "Хатогӣ рух дод"),
    });
  };

  const handleRestore = () => {
    updatePost(
      { status: "active" },
      {
        onSuccess: () => toast.success("Эълон барқарор карда шуд"),
        onError: (err: any) => toast.error(err.message || "Хатогӣ рух дод"),
      },
    );
  };

  const handlePermanentDelete = () => {
    permanentlyDeletePost(item.id, {
      onSuccess: () => {
        toast.success("Эълон пурра нест карда шуд");
        router.push("/admin/posts");
      },
      onError: (err: any) => toast.error(err.message || "Хатогӣ рух дод"),
    });
  };

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <StatusPill status={item.type} />
          <StatusPill status={item.moderation_status} />
          {item.is_resolved && <StatusPill status="resolved" />}
          {isDeleted && <StatusPill status="deleted" />}
        </div>
        {isDeleted ? (
          <>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleRestore} disabled={restoring}>
              <RotateCcw className="w-4 h-4" />
              Барқарор кардан
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="gap-2"
              onClick={() => setPermanentDeleteOpen(true)}
              disabled={permanentlyDeleting}
            >
              <FlameKindling className="w-4 h-4" />
              Пурра нест кардан
            </Button>
          </>
        ) : (
          <Button variant="destructive" size="sm" className="gap-2" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="w-4 h-4" />
            Нест кардан
          </Button>
        )}
      </div>

      <div>
        <h1 className="text-lg font-black text-zinc-900 tracking-tight">{item.title}</h1>
        <p className="text-sm font-medium text-zinc-500 mt-1">{item.description}</p>
      </div>

      {item.images.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {item.images.map((img) => (
            <div key={img.image_url} className="w-24 h-24 rounded-xl overflow-hidden bg-zinc-100 shrink-0">
              <Image src={img.image_url} alt={item.title} width={96} height={96} className="object-cover w-full h-full" />
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-bold text-zinc-500 pt-2 border-t border-zinc-100">
        <span className="flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5" /> {item.category}
        </span>
        <span className="flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5" /> {item.views} назар
        </span>
        <Link href={`/admin/users/${item.user_id}`} className="text-blue-600 hover:underline">
          Соҳиб: {ownerName}
        </Link>
      </div>

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Эълонро нест кардан?"
        description={`«${item.title}»-ро нест мекунед (soft-delete) — аз рӯйхатҳо пинҳон мешавад, аммо маълумоташ дар система мемонад. Баъдан метавонед онро бо "Барқарор кардан" баргардонед.`}
        onConfirm={handleDelete}
        loading={isPending}
      />

      <DeleteConfirmDialog
        open={permanentDeleteOpen}
        onOpenChange={setPermanentDeleteOpen}
        title="Пурра нест кардан?"
        description={`«${item.title}»-ро ва ҳамаи аксҳояшро БЕБОЗГАШТ нест мекунед. Ин амал бекор карда намешавад (танҳо як snapshot дар архив мемонад).`}
        onConfirm={handlePermanentDelete}
        loading={permanentlyDeleting}
      />
    </div>
  );
}
