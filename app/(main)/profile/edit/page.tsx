"use client";

import { UserProfile } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/lib/language-context";

export default function EditProfilePage() {
  const { t } = useLanguage();
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" asChild className="rounded-full">
          <Link href="/profile"><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <h1 className="text-2xl font-black uppercase tracking-tight">{t('personalInfo')}</h1>
      </div>

      <div className="flex justify-center">
        <UserProfile 
          routing="hash"
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "shadow-none border border-zinc-100 dark:border-zinc-800 rounded-2xl w-full",
              navbar: "hidden md:flex",
              headerTitle: "text-xl font-black uppercase tracking-tight",
              headerSubtitle: "text-zinc-500 text-sm",
              profileSectionTitleText: "font-black uppercase text-xs tracking-wider text-zinc-400"
            }
          }}
        />
      </div>
    </div>
  );
}
