"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Package, Flag, UserX, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePendingPostsCount } from "@/lib/hooks/use-admin-posts";
import { usePendingReportsCount } from "@/lib/hooks/use-admin-reports";
import { usePendingDeletionRequestsCount } from "@/lib/hooks/use-admin-deletion-requests";

export const NAV_ITEMS = [
  { href: "/admin", label: "Дашборд", icon: LayoutDashboard },
  { href: "/admin/users", label: "Корбарон", icon: Users },
  { href: "/admin/posts", label: "Эълонҳо", icon: Package },
  { href: "/admin/reports", label: "Шикоятҳо", icon: Flag },
  { href: "/admin/deletion-requests", label: "Нест кардани ҳисоб", icon: UserX },
];

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

/** Badge-и сурхи шумора — барои эълонҳои "дар интизор", ки бе AI moderation омадаанд. */
function PendingBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** Рӯйхати навигатсия бо матн — барои Sheet-и мобилӣ. */
export function AdminNavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: pendingCount = 0 } = usePendingPostsCount();
  const { data: pendingReports = 0 } = usePendingReportsCount();
  const { data: pendingDeletions = 0 } = usePendingDeletionRequestsCount();

  return (
    <nav className="flex-1 px-3 py-4 space-y-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold transition-colors",
              active
                ? "bg-zinc-900 text-white shadow-sm"
                : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900",
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
            {href === "/admin/posts" && <PendingBadge count={pendingCount} />}
            {href === "/admin/reports" && <PendingBadge count={pendingReports} />}
            {href === "/admin/deletion-requests" && <PendingBadge count={pendingDeletions} />}
          </Link>
        );
      })}
    </nav>
  );
}

/** Sidebar-и сафед бо аксенти кабуд — матн ҳамеша торик/кабуд аст, на сафед. */
export function AdminSidebar() {
  const pathname = usePathname();
  const { data: pendingCount = 0 } = usePendingPostsCount();
  const { data: pendingReports = 0 } = usePendingReportsCount();
  const { data: pendingDeletions = 0 } = usePendingDeletionRequestsCount();

  return (
    <aside className="hidden md:flex md:w-64 shrink-0 flex-col bg-white border-r border-zinc-100">
      <div className="h-20 flex items-center px-8 shrink-0">
        <span className="text-lg font-black tracking-tight text-blue-600">Administration</span>
      </div>

      <nav className="flex-1 px-5 py-2 space-y-1.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-bold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2",
                active
                  ? "bg-blue-50 text-blue-600"
                  : "text-zinc-500 hover:bg-blue-50 hover:text-blue-600 focus-visible:text-blue-600",
              )}
            >
              <Icon className="w-[18px] h-[18px] shrink-0" />
              {label}
              {href === "/admin/posts" && <PendingBadge count={pendingCount} />}
              {href === "/admin/reports" && <PendingBadge count={pendingReports} />}
              {href === "/admin/deletion-requests" && <PendingBadge count={pendingDeletions} />}
            </Link>
          );
        })}
      </nav>

      <Link
        href="/"
        className="flex items-center gap-2 mx-7 mb-6 text-[11px] font-bold text-zinc-400 hover:text-blue-600 transition-colors shrink-0 outline-none focus-visible:text-blue-600"
      >
        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
        Назар ба сайт
      </Link>
    </aside>
  );
}
