"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Package, UserX, ExternalLink, Bot, Crown, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePendingPostsCount } from "@/lib/hooks/use-admin-posts";
import { usePendingDeletionRequestsCount } from "@/lib/hooks/use-admin-deletion-requests";

export const NAV_ITEMS = [
  { href: "/admin", label: "Дашборд", icon: LayoutDashboard },
  { href: "/admin/users", label: "Корбарон", icon: Users },
  { href: "/admin/posts", label: "Эълонҳо", icon: Package },
  { href: "/admin/matches", label: "Мутобиқатҳои AI", icon: Bot },
  { href: "/admin/analytics", label: "Аналитика", icon: BarChart3 },
  { href: "/admin/subscriptions", label: "VIP/VVIP", icon: Crown },
  { href: "/admin/deletion-requests", label: "Нест кардани ҳисоб", icon: UserX },
];

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

/** Red count badge — for "pending" posts that came in without AI moderation. */
function PendingBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-medium flex items-center justify-center">
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** Navigation list with text — for the mobile Sheet. */
export function AdminNavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: pendingCount = 0 } = usePendingPostsCount();
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
              "flex items-center gap-3 rounded-md px-3.5 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-emerald-500 text-white"
                : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white",
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
            {href === "/admin/posts" && <PendingBadge count={pendingCount} />}
            {href === "/admin/deletion-requests" && <PendingBadge count={pendingDeletions} />}
          </Link>
        );
      })}

      {/* Back to site — previously this only existed in the desktop sidebar, meaning
          on mobile there was no way out of the admin panel back to the site. */}
      <Link
        href="/"
        onClick={onNavigate}
        className="flex items-center gap-3 rounded-md px-3.5 py-2.5 text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        <ExternalLink className="w-4 h-4 shrink-0" />
        Назар ба сайт
      </Link>
    </nav>
  );
}

/** Sidebar with a blue accent — the admin panel has its own color, separate from
 *  the public site's green. */
export function AdminSidebar() {
  const pathname = usePathname();
  const { data: pendingCount = 0 } = usePendingPostsCount();
  const { data: pendingDeletions = 0 } = usePendingDeletionRequestsCount();

  return (
    <aside className="hidden md:flex md:w-64 shrink-0 flex-col bg-white dark:bg-zinc-900 border-r border-zinc-100 dark:border-zinc-800">
      <div className="h-20 flex items-center px-8 shrink-0">
        <span className="text-lg font-semibold tracking-tight text-blue-600 dark:text-blue-400">Administration</span>
      </div>

      <nav className="flex-1 px-5 py-2 space-y-1.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-4 py-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900",
                active
                  ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  : "text-zinc-500 dark:text-zinc-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400 focus-visible:text-blue-600",
              )}
            >
              <Icon className="w-[18px] h-[18px] shrink-0" />
              {label}
              {href === "/admin/posts" && <PendingBadge count={pendingCount} />}
              {href === "/admin/deletion-requests" && <PendingBadge count={pendingDeletions} />}
            </Link>
          );
        })}
      </nav>

      <Link
        href="/"
        className="flex items-center gap-2 mx-7 mb-6 text-[11px] font-medium text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors shrink-0 outline-none focus-visible:text-blue-600"
      >
        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
        Назар ба сайт
      </Link>
    </aside>
  );
}
