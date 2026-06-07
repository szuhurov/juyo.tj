"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h2 className="text-xl font-semibold">Хатогӣ рух дод</h2>
      <p className="text-sm text-muted-foreground max-w-xs">
        Мушкиле пайдо шуд. Лутфан саҳифаро навсозӣ кунед.
      </p>
      <Button onClick={reset}>Навсозӣ</Button>
    </div>
  );
}
