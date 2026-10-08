/**
 * Owner decision 2026-10-07: a photo of a document or a payment card is
 * never uploaded. On real Tajik ID cards and bank cards the on-device OCR
 * missed embossed, turned and mirrored numbers (and CVV codes) on 9 of 16
 * photos, so covering only what OCR reads cannot be made safe. Listings in
 * these categories show a JUYO image instead; nothing of the document leaves
 * the device. The database enforces the same rule for every client
 * (migration 20261007030000_document_photo_placeholders).
 *
 * Kept byte-identical in Web/lib and app/lib (app/__tests__/shared-lib-parity.test.ts).
 */
export const NO_PHOTO_CATEGORIES: readonly string[] = ['Documents', 'Cards'];

const PLACEHOLDER_BASE = 'https://juyo.tj/placeholders/';

export function isNoPhotoCategory(category: string | null | undefined): boolean {
  return !!category && NO_PHOTO_CATEGORIES.includes(category);
}

/** The image a Documents/Cards listing shows instead of a photo. */
export function placeholderImageUrl(category: string | null | undefined): string {
  return `${PLACEHOLDER_BASE}${category === 'Cards' ? 'card' : 'document'}.png`;
}

export function isPlaceholderUrl(url: string | null | undefined): boolean {
  return !!url && url.startsWith(PLACEHOLDER_BASE);
}

/**
 * A photo the person chose to hide completely in the privacy editor: it is
 * never uploaded, and the listing shows the document image in its place.
 */
export const HIDDEN_PHOTO_URI = 'juyo:hidden-photo';

export function isHiddenPhotoUri(uri: string | null | undefined): boolean {
  return uri === HIDDEN_PHOTO_URI;
}
