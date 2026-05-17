/**
 * Саҳифаи боргузории сабук (Loading State).
 * Ин файл ҳамчун индикатори навигация хизмат мекунад.
 */
export default function Loading() {
  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-1 bg-emerald-500/10 overflow-hidden pointer-events-none">
      <div className="h-full bg-emerald-500 animate-[loading_1.5s_ease-in-out_infinite] w-full origin-left"></div>
    </div>
  );
}

