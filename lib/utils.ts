/**
 * Helper functions (Utilities).
 * This file contains general-purpose functions for working with CSS classes and other small operations.
 */

import { clsx, type ClassValue } from "clsx" // This is for classes
import { twMerge } from "tailwind-merge" // For resolving conflicting Tailwind classes

// Function for merging Tailwind classes without conflicts
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * A safety net for document text: strips runs of 6+ digits.
 *
 * The AI itself is already responsible for leaving passport numbers out of
 * the text (see DOCUMENT_TEXT_RULES in supabase/functions/ai-brain). This
 * is only here so that if the model slips up once, a real person's
 * document number doesn't end up on the PUBLIC page.
 *
 * Name/surname, date, and phone number in plain format are left untouched —
 * they make the item identifiable and must be preserved.
 */
export function stripDocumentNumbers(text: string): string {
  return (
    text
      // A prefix attached to the number ("A1234567", "AB 1234567") —
      // otherwise a lone leftover letter like "№ A" would remain. The
      // preceding character is restored ($1), otherwise "рақами 1234567"
      // would have the word "рақами" cut off. Lookbehind is not used —
      // old Safari rejects it at parse time and the whole page crashes.
      .replace(/(^|[^\p{L}\p{N}])[\p{L}]{0,2}[\s-]?\d{6,}/gu, "$1")
      // The glued-together case ("рақами1234567"), which the rule above doesn't catch.
      .replace(/\d{6,}/g, "")
      // A leftover "№" with nothing after it, once the number has been stripped.
      .replace(/[№#]\s*(?=[,.!?;:)]|$)/g, "")
      .replace(/\s{2,}/g, " ")
      .replace(/\s+([,.!?;:])/g, "$1")
      .replace(/[\s,;:]+$/g, "")
      .trim()
  );
}
