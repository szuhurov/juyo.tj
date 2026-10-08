/**
 * Web side of "hide completely" in the privacy editor (the app uses
 * HIDDEN_PHOTO_URI from lib/photo-policy.ts): the editor hands back an empty
 * File marked here instead of the photo. It is never uploaded; the listing
 * shows the document image (placeholderImageUrl("Documents")) in its place.
 */
const hidden = new WeakSet<File>();

export function makeHiddenPhoto(name = "hidden-photo.jpg"): File {
  const file = new File([], name, { type: "image/jpeg", lastModified: Date.now() });
  hidden.add(file);
  return file;
}

export function isHiddenPhotoFile(file: File | null | undefined): boolean {
  return !!file && hidden.has(file);
}
