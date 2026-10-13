"use client";

import Link from "next/link";
import { QrCode } from "lucide-react";

export interface QrStats {
  /** Users who set up their QR at least once. */
  users: number;
  /** Of those, how many have it switched on now. */
  active: number;
  /** Scans of everyone's QR, all time. */
  scans: number;
  list: {
    id: string;
    name: string;
    phone: string | null;
    is_qr_active: boolean;
    qr_activation_count: number;
    qr_scan_count: number;
  }[];
}

/**
 * Dashboard: who set up a QR code and how often it was scanned. The database
 * keeps counters only (no dates), so these numbers are always "all time".
 */
export function QrStatsPanel({ qr }: { qr: QrStats | null }) {
  if (!qr) return null;

  return (
    <div className="min-w-0 rounded-md border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <QrCode className="w-4 h-4 text-zinc-400" />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">QR-код</h3>
        </div>
        <span className="text-[11px] font-medium text-zinc-400">Ҳама вақт</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "QR насб карданд", value: qr.users },
          { label: "Ҳоло фаъол", value: qr.active },
          { label: "Scan шуд", value: qr.scans },
        ].map((x) => (
          <div key={x.label} className="rounded-md bg-zinc-50 dark:bg-zinc-900/40 p-3">
            <p className="text-[11px] font-medium text-zinc-500">{x.label}</p>
            <p className="text-2xl font-semibold text-zinc-900 dark:text-white tabular-nums">{x.value}</p>
          </div>
        ))}
      </div>

      {qr.list.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <div className="min-w-[520px]">
            <div className="grid grid-cols-[1.6fr_1.1fr_0.7fr_0.7fr_0.8fr] gap-3 px-2 pb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-400 border-b border-zinc-100 dark:border-zinc-700">
              <span>Корбар</span>
              <span>Тамос</span>
              <span>Насб</span>
              <span>Scan</span>
              <span>Ҳолат</span>
            </div>
            <div className="max-h-[340px] overflow-y-auto">
              {qr.list.map((u) => (
                <Link
                  key={u.id}
                  href={`/admin/users/${u.id}`}
                  className="grid grid-cols-[1.6fr_1.1fr_0.7fr_0.7fr_0.8fr] gap-3 items-center px-2 py-2 text-sm rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
                >
                  <span className="truncate font-semibold text-zinc-800 dark:text-zinc-100">{u.name}</span>
                  <span className="truncate text-zinc-500 dark:text-zinc-400">{u.phone ?? "—"}</span>
                  <span className="tabular-nums text-zinc-600 dark:text-zinc-300">{u.qr_activation_count}</span>
                  <span className="tabular-nums font-semibold text-zinc-900 dark:text-white">{u.qr_scan_count}</span>
                  <span className={u.is_qr_active ? "text-xs font-semibold text-emerald-600 dark:text-emerald-400" : "text-xs font-semibold text-zinc-400"}>
                    {u.is_qr_active ? "Фаъол" : "Хомӯш"}
                  </span>
                </Link>
              ))}
            </div>
          </div>
          {qr.users > qr.list.length && (
            <p className="mt-2 text-xs text-zinc-500">
              Нишон дода шуд: {qr.list.length} аз {qr.users} (аз рӯи шумораи scan).
            </p>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm text-zinc-500">Ҳанӯз ҳеҷ кас QR насб накардааст.</p>
      )}
    </div>
  );
}
