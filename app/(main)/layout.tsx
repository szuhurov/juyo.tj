import { Header } from "@/components/header";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 pt-16">
        {children}
      </main>
      <footer className="border-t py-8 bg-zinc-50 dark:bg-zinc-950 mt-12">
        <div className="container mx-auto px-4 text-center text-zinc-500 text-sm">
          <p>© {new Date().getFullYear()} JUYO.TJ - All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
