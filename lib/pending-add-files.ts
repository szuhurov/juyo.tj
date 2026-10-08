/**
 * The category (and, unless it is Documents/Cards, the photos) picked in the
 * Add launcher (the sheets that open from the navbar "+", like the app's
 * AddPhotoLauncher), handed to /items/add. In-memory only: the hand-off is a
 * client-side navigation within the same tab.
 */
export interface PendingAdd {
  category: string;
  files: File[];
}

let pending: PendingAdd | null = null;

/** Fired after a new choice is stored (an already-open /items/add listens for it). */
export const PENDING_ADD_FILES_EVENT = "pending-add-files";

export function setPendingAdd(value: PendingAdd) {
  pending = value;
  window.dispatchEvent(new Event(PENDING_ADD_FILES_EVENT));
}

/** Returns the pending choice once and clears it. */
export function takePendingAdd(): PendingAdd | null {
  const value = pending;
  pending = null;
  return value;
}
