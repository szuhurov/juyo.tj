"use client";

import { SignOutButton } from "@clerk/nextjs";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BlockedAccountScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-canvas">
      <div className="max-w-sm w-full text-center space-y-4">
        <div className="w-14 h-14 rounded-md bg-rose-50 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-7 h-7 text-rose-500" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Ҳисоби шумо блок шудааст</h1>
          <p className="text-sm font-medium text-slate-500 mt-2">
            Дастрасии шумо ба juyo.tj маҳдуд карда шудааст. Агар фикр мекунед ин хатост, лутфан бо мо тамос гиред.
          </p>
        </div>
        <SignOutButton redirectUrl="/">
          <Button variant="outline" className="rounded-md">
            Баромадан
          </Button>
        </SignOutButton>
      </div>
    </div>
  );
}
