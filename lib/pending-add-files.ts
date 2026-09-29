/**
 * Photos picked in the Add launcher (the sheet that opens from the navbar
 * "+", like the app's AddPhotoLauncher), handed to /items/add. In-memory only:
 * the hand-off is a client-side navigation within the same tab.
 */
let pending: File[] | null = null;

/** Fired after new photos are stored (an already-open /items/add listens for it). */
export const PENDING_ADD_FILES_EVENT = "pending-add-files";

export function setPendingAddFiles(files: File[]) {
  pending = files;
  window.dispatchEvent(new Event(PENDING_ADD_FILES_EVENT));
}

/** Returns the pending photos once and clears them. */
export function takePendingAddFiles(): File[] | null {
  const files = pending;
  pending = null;
  return files;
}
