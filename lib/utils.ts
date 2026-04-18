/**
 * Функсияҳои ёрирасон (Utilities).
 * Ин файл функсияҳои умумиро барои кор бо CSS классҳо ва дигар амалиётҳои хурд дар бар мегирад.
 */

import { clsx, type ClassValue } from "clsx" // Ин барои классҳост
import { twMerge } from "tailwind-merge" // Барои классҳои Tailwind-и зӯр

// Функсия барои якҷоя кардани Tailwind классҳо бе мушкилӣ
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
