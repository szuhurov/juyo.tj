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
    <div className="min-h-screen md:h-screen bg-white md:bg-zinc-100 md:p-4">
      <div className="flex flex-col md:flex-row min-h-screen md:h-full bg-white md:rounded-[28px] md:shadow-sm md:overflow-hidden">
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
