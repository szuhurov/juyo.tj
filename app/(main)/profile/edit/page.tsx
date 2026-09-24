/**
 * This page is for editing account information (Identity Settings).
 * We use Clerk's UserProfile component here, so the user can change
 * their password or email.
 */

"use client";

import { UserProfile } from "@clerk/nextjs"; // Clerk's user profile component
import { useLanguage } from "@/lib/language-context"; // For language translation

export default function EditProfilePage() {
  // Hook for getting translations
  const { t } = useLanguage();

  return (
    <div className="container mx-auto px-2.5 sm:px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <h1 className="text-2xl font-bold tracking-tight">{t('personalInfo')}</h1>
      </div>

      {/* Rendering Clerk's UI for managing the profile (UserProfile Component) */}
      <div className="flex justify-center">
        <UserProfile 
          routing="hash"
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "shadow-none border border-hairline dark:border-zinc-700 rounded-md w-full",
              navbar: "hidden md:flex",
              headerTitle: "text-xl font-semibold tracking-tight",
              headerSubtitle: "text-slate-500 text-sm",
              profileSectionTitleText: "font-medium text-xs tracking-wider text-slate-400"
            }
          }}
        />
      </div>
    </div>
  );
}
