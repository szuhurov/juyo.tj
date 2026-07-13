import { QrCode, Zap, ScanLine } from "lucide-react";
import { StatusPill } from "@/components/admin/status-pill";
import type { AdminUserDetail } from "@/lib/hooks/use-admin-users";

export function UserQrStats({ profile }: { profile: AdminUserDetail["profile"] }) {
  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <QrCode className="w-4 h-4 text-zinc-400" />
          <span className="text-sm font-black text-zinc-900">Ҳолати QR-код</span>
        </div>
        <StatusPill
          status={profile.is_qr_active ? "approved" : "deleted"}
          label={profile.is_qr_active ? "Насб шудааст" : "Насб нашудааст"}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-blue-50 p-4">
          <div className="flex items-center gap-2 text-blue-600">
            <Zap className="w-4 h-4" />
            <span className="text-xs font-bold">Чанд бор насб кардааст</span>
          </div>
          <p className="text-2xl font-black text-blue-900 mt-2">{profile.qr_activation_count}</p>
        </div>

        <div className="rounded-xl bg-emerald-50 p-4">
          <div className="flex items-center gap-2 text-emerald-600">
            <ScanLine className="w-4 h-4" />
            <span className="text-xs font-bold">Чанд бор scan шудааст</span>
          </div>
          <p className="text-2xl font-black text-emerald-900 mt-2">{profile.qr_scan_count}</p>
        </div>
      </div>
    </div>
  );
}
