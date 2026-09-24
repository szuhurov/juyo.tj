"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { BellRing, Trash2, RotateCcw, Camera, Loader2, FlameKindling } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/admin/status-pill";
import { DeleteConfirmDialog } from "@/components/admin/delete-confirm-dialog";
import { SendNotificationDialog } from "@/components/admin/users/send-notification-dialog";
import { VerifiedBadge } from "@/components/verified-badge";
import {
  useDeleteAdminUser,
  useUpdateAdminUser,
  useUploadUserAvatar,
  usePermanentlyDeleteUser,
} from "@/lib/hooks/use-admin-users";
import type { AdminUserDetail } from "@/lib/hooks/use-admin-users";

export function UserDetailHeader({ profile }: { profile: AdminUserDetail["profile"] }) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [permanentDeleteOpen, setPermanentDeleteOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { mutate: deleteUser, isPending: deleting } = useDeleteAdminUser();
  const { mutate: updateUser, isPending: restoring } = useUpdateAdminUser(profile.id);
  const { mutate: uploadAvatar, isPending: uploading } = useUploadUserAvatar(profile.id);
  const { mutate: permanentlyDeleteUser, isPending: permanentlyDeleting } = usePermanentlyDeleteUser();

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    uploadAvatar(file, {
      onSuccess: () => toast.success("Акс иваз карда шуд"),
      onError: (err: Error) => toast.error(err.message || "Хатогӣ рух дод"),
    });
  };

  const name = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "Беном";
  const isDeleted = profile.status === "deleted";

  const handleDelete = () => {
    deleteUser(profile.id, {
      onSuccess: () => {
        toast.success("Корбар нест карда шуд");
        setDeleteOpen(false);
      },
      onError: (err: Error) => toast.error(err.message || "Хатогӣ рух дод"),
    });
  };

  const handleRestore = () => {
    updateUser(
      { status: null },
      {
        onSuccess: () => toast.success("Корбар барқарор карда шуд"),
        onError: (err: Error) => toast.error(err.message || "Хатогӣ рух дод"),
      },
    );
  };

  const handlePermanentDelete = () => {
    permanentlyDeleteUser(profile.id, {
      onSuccess: () => {
        toast.success("Ҳисоб пурра нест карда шуд — аз Clerk низ");
        router.push("/admin/users");
      },
      onError: (err: Error) => toast.error(err.message || "Хатогӣ рух дод"),
    });
  };

  return (
    <div className="rounded-md border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-800 p-5 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="relative w-14 h-14 rounded-full group shrink-0"
        >
          <Avatar className="w-14 h-14 border border-zinc-100 dark:border-zinc-800">
            <AvatarImage src={profile.avatar_url ?? undefined} alt={name} />
            <AvatarFallback className="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-semibold text-lg">
              {name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            {uploading ? (
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            ) : (
              <Camera className="w-4 h-4 text-white" />
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">{name}</h1>
            {profile.is_verified && <VerifiedBadge />}
            <StatusPill status={profile.status ?? "active"} />
          </div>
          <p className="text-xs font-medium text-zinc-400 mt-0.5">
            Пайваст шуд: {format(new Date(profile.created_at), "d MMMM yyyy")}
            {profile.last_login_at && ` · Вуруди охирин: ${format(new Date(profile.last_login_at), "d MMM yyyy, HH:mm")}`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setNotifyOpen(true)}>
          <BellRing className="w-4 h-4" />
          Хабарнома
        </Button>
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

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Корбарро нест кардан?"
        description={`«${name}»-ро нест мекунед (soft-delete). Эълонҳои ӯ дар система мемонанд — метавонед онҳоро алоҳида идора кунед. Ин амалро баъдан бо "Барқарор кардан" бекор карда мешавад.`}
        onConfirm={handleDelete}
        loading={deleting}
      />

      <DeleteConfirmDialog
        open={permanentDeleteOpen}
        onOpenChange={setPermanentDeleteOpen}
        title="Пурра нест кардан?"
        description={`«${name}»-ро ва ҳамаи эълонҳо, захирашуда, сандуқча ва дархостҳояшро БЕБОЗГАШТ нест мекунед — инчунин ҳисоби ӯро аз Clerk низ нест мекунед. Ин амал бекор карда намешавад (танҳо як snapshot дар архиви admin мемонад).`}
        onConfirm={handlePermanentDelete}
        loading={permanentlyDeleting}
      />

      <SendNotificationDialog
        open={notifyOpen}
        onOpenChange={setNotifyOpen}
        target={{ mode: "single", userIds: [profile.id] }}
        targetLabel={name}
      />
    </div>
  );
}
