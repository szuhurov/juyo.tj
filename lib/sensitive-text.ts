/**
 * Masks numbers in listing text that could be used to misuse someone's
 * document or bank card. Mirrored in app/lib/sensitive-text.ts and in the
 * database trigger `items_mask_sensitive_numbers` (migration
 * 20261003000000_document_privacy), which also covers old app builds —
 * keep all three in sync (app/__tests__/shared-lib-parity.test.ts).
 */
export const DOCUMENTS_CATEGORY = "Documents";
export const NUMBER_MASK = "••••";

// A digit run may use single spaces or dashes as group separators
// ("1234 5678 9012 3456", "12-34-567890").
const CARD_NUMBER = /\d(?:[ -]?\d){12,}/g; // 13+ digits — bank cards, in any category
const DOCUMENT_NUMBER = /\d(?:[ -]?\d){5,}/g; // 6+ digits — passport, ID, licence numbers

export function isDocumentCategory(category: string | null | undefined): boolean {
  return category === DOCUMENTS_CATEGORY;
}

export function maskSensitiveNumbers(text: string, category: string | null | undefined): string {
  return text.replace(isDocumentCategory(category) ? DOCUMENT_NUMBER : CARD_NUMBER, NUMBER_MASK);
}
