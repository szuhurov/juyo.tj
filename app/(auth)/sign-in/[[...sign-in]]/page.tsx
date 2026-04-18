/**
 * Саҳифаи воридшавӣ (Sign In Page).
 * Дар ин ҷо корбарон ба профили худ ворид мешаванд (логин мекунанд).
 * Ҳамааш дар асоси Clerk кор мекунад.
 */
import { SignIn } from "@clerk/nextjs"; // Барои ворид шудан ба профил

export default function Page() {
  return (
    // Контейнер барои марказонидани (center) формаи воридшавӣ
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      {/* Виҷети тайёри Clerk барои логин */}
      <SignIn />
    </div>
  );
}
