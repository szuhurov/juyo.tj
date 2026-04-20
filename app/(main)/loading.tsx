import Image from "next/image";

/**
 * Саҳифаи боргузорӣ (Loading State).
 * Вақте ки Next.js маълумотро аз сервер мегирад, ин саҳифа нишон дода мешавад.
 * Логотипи JUYO дар марказ бо эффекти зебои "pulse" нишон дода мешавад.
 */
export default function Loading() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white dark:bg-zinc-950">
      <div className="relative flex flex-col items-center animate-pulse text-center">
        {/* Логотипи асосӣ дар марказ */}
        <div className="relative w-32 h-32 mb-4">
          <Image
            src="/logo.jpg"
            alt="JUYO Logo"
            fill
            className="object-contain"
            priority
          />
        </div>
        
        {/* Анимацияи иловагӣ барои боргузорӣ */}
        <div className="flex gap-1.5 justify-center">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce"></div>
        </div>
      </div>
    </div>
  );
}
