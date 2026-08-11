import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { isAdminUser } from "@/lib/admin-auth";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";
import { AdminSearchProvider } from "@/lib/admin-search-context";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!isAdminUser(userId)) {
    redirect("/");
  }

  return (
    // bg-canvas — ҳамон токене, ки тамоми сайт истифода мебарад (равшан
    // #f1f5f9, торик сиёҳ). Пеш аз ин панел `bg-zinc-100`-и собит дошт ва
    // дар реҷаи торик сафеди кӯркунанда мемонд.
    <div className="min-h-screen md:h-screen bg-white dark:bg-zinc-900 md:bg-canvas md:p-4">
      <div className="flex flex-col md:flex-row min-h-screen md:h-full bg-white dark:bg-zinc-900 md:rounded-[28px] md:border md:border-zinc-200 md:dark:border-zinc-800 md:overflow-hidden">
        <AdminSidebar />
        <AdminSearchProvider>
          <div className="flex-1 min-w-0 flex flex-col md:overflow-hidden">
            <AdminTopbar />
            <main className="flex-1 p-4 lg:p-6 md:overflow-y-auto">{children}</main>
          </div>
        </AdminSearchProvider>
      </div>
    </div>
  );
}
