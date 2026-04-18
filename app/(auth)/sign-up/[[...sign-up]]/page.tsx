/**
 * Саҳифаи бақайдгирӣ (Sign Up Page).
 * Ин файл барои сохтани аккаунти нави корбар бо ёрии Clerk хизмат мекунад.
 */
import { SignUp } from "@clerk/nextjs"; // Барои сабти номи корбар

export default function Page() {
  return (
    // Контейнер барои дар марказ (center) нишон додани форма
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      {/* Виҷети тайёри Clerk барои регистрация */}
      <SignUp />
    </div>
  );
}
