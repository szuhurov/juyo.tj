import { finalizePhoto, protectPhoto } from "@/lib/photo-privacy";
import { DOCUMENT_CATEGORIES, type Rect } from "@/lib/privacy-pipeline";

/**
 * Privacy state of a listing photo, kept beside the File the pages already
 * hold (mirrors app/lib/prepare-photos.ts).
 */
interface PhotoState {
  /** This file is the pipeline's safe output for that category — only such files are uploaded. */
  safeFor?: { category: string | null };
  /** The person covered this exact file in the editor (these areas); the pipeline still re-checks it. */
  reviewedCovers?: Rect[];
}

const states = new WeakMap<File, PhotoState>();

/** The privacy editor's output, covered by hand; still re-checked by preparePhotos. */
export function markReviewed(file: File, covers: Rect[]) {
  states.set(file, { reviewedCovers: covers });
}

export function isSafeFor(file: File, category: string | null | undefined) {
  return states.get(file)?.safeFor?.category === (category ?? null);
}

export type OpenEditor = (
  files: File[],
  documentMode: boolean,
  initialRegions: (Rect[] | null)[],
) => Promise<{ files: File[]; covers: Rect[][] } | null>;

export interface PrepareOutcome {
  /** "person_photo": some photos show a person and were taken out of `files` (`removed` of them). */
  status: "ready" | "cancelled" | "still_visible" | "person_photo";
  files: File[];
  /** Something was covered without the person opening the editor. */
  autoCovered: boolean;
  removed?: number;
}

/**
 * Runs every photo that is not yet safe for `category` through the
 * on-device pipeline. Photos that need a person's check are opened in the
 * privacy editor together, pre-covered; the editor's output is validated
 * again. Resolves `ready` only when every photo is safe to upload.
 */
export async function preparePhotos(files: File[], category: string | null | undefined, openEditor: OpenEditor): Promise<PrepareOutcome> {
  const cat = category ?? null;
  const out = files.slice();
  let autoCovered = false;
  const review: { index: number; regions: Rect[] | null; documentLike: boolean }[] = [];
  const blocked = new Set<number>();

  const markSafe = (index: number, file: File) => {
    states.set(file, { safeFor: { category: cat } });
    out[index] = file;
  };

  await Promise.all(out.map(async (file, index) => {
    if (isSafeFor(file, cat)) return;
    const reviewed = states.get(file)?.reviewedCovers;
    const result = reviewed ? await finalizePhoto(file, reviewed, cat, true) : await protectPhoto(file, cat);
    if (result.status === "blocked") {
      blocked.add(index);
    } else if (result.status === "safe") {
      if (result.file !== file && !reviewed) autoCovered = true;
      markSafe(index, result.file);
    } else {
      const unavailable = result.assessment.reasons.includes("detector_unavailable");
      review.push({ index, regions: unavailable ? null : result.assessment.regions, documentLike: result.assessment.documentLike });
      out[index] = result.file;
    }
  }));

  // A photo of a person is refused before anything else; the rest stay as they are.
  if (blocked.size > 0) {
    return { status: "person_photo", files: out.filter((_, i) => !blocked.has(i)), autoCovered: false, removed: blocked.size };
  }

  if (review.length > 0) {
    review.sort((a, b) => a.index - b.index);
    const documentMode = (!!cat && DOCUMENT_CATEGORIES.includes(cat)) || review.some((r) => r.documentLike);
    const edited = await openEditor(review.map((r) => out[r.index]), documentMode, review.map((r) => r.regions));
    if (!edited) return { status: "cancelled", files: out, autoCovered: false };
    let stillVisible = false;
    await Promise.all(review.map(async (r, k) => {
      const covers = edited.covers[k] ?? [];
      const result = await finalizePhoto(edited.files[k], covers, cat, true);
      if (result.status === "safe") {
        markSafe(r.index, result.file);
      } else {
        stillVisible = true;
        markReviewed(result.file, covers);
        out[r.index] = result.file;
      }
    }));
    if (stillVisible) return { status: "still_visible", files: out, autoCovered };
  }
  return { status: "ready", files: out, autoCovered };
}
