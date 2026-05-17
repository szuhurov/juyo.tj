"use client";

/**
 * Саҳифаи боргузории сабук (Loading State).
 * Дар Next.js ин файл ҳамчун fallback барои тамоми масирҳои (main) истифода мешавад.
 * Барои он ки ба Skeleton-ҳои дохилии саҳифаҳо халал нарасонад, мо онро 
 * танҳо ҳамчун як индикатори сабук дар боло ё марказ мемонем.
 */
export default function Loading() {
  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-1 bg-emerald-500/10 overflow-hidden">
      <div className="h-full bg-emerald-500 animate-[loading_1.5s_ease-in-out_infinite] w-full origin-left"></div>
      <style jsx>{`
        @keyframes loading {
          0% { transform: translateX(-100%) scaleX(0.2); }
          50% { transform: translateX(0) scaleX(0.5); }
          100% { transform: translateX(100%) scaleX(0.2); }
        }
      `}</style>
    </div>
  );
}
