/**
 * Uploads one listing photo to the public `items` bucket together with its
 * small copy for cards and lists (`-thumb`). Feeds load the small copy:
 * the full photo is only for the listing page.
 *
 * Files are cached for a year (PHOTO_CACHE_SECONDS, lib/photo-policy.ts).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { compressImage } from "@/lib/image-utils";
import { PHOTO_CACHE_SECONDS } from "@/lib/photo-policy";

/** Cards are ~180 px wide; 600 px stays sharp on 3× screens. */
export const THUMB_WIDTH = 600;
export const THUMB_QUALITY = 0.75;

export interface UploadedPhoto {
  url: string;
  /** Null when only the small copy failed — cards then fall back to the full photo. */
  thumbUrl: string | null;
  /** The exact uploaded file (re-encoded, no EXIF/GPS) — used for its search vector. */
  file: File;
}

export async function uploadListingPhoto(supabase: SupabaseClient, file: File): Promise<UploadedPhoto> {
  const bucket = supabase.storage.from("items");
  const compressed = await compressImage(file);
  const ext = compressed.name.split(".").pop();
  const base = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const path = `${base}.${ext}`;
  const { error } = await bucket.upload(path, compressed, { cacheControl: PHOTO_CACHE_SECONDS });
  if (error) throw error;
  const url = bucket.getPublicUrl(path).data.publicUrl;

  let thumbUrl: string | null = null;
  try {
    const thumb = await compressImage(compressed, THUMB_WIDTH, THUMB_QUALITY);
    const thumbPath = `${base}-thumb.${thumb.name.split(".").pop()}`;
    const { error: thumbError } = await bucket.upload(thumbPath, thumb, { cacheControl: PHOTO_CACHE_SECONDS });
    if (!thumbError) thumbUrl = bucket.getPublicUrl(thumbPath).data.publicUrl;
  } catch {
    // see thumbUrl
  }
  return { url, thumbUrl, file: compressed };
}
