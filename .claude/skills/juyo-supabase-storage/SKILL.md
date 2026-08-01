---
name: juyo-supabase-storage
description: Handle JUYO image uploads, storage paths, public URLs, and cleanup in the Supabase "items" bucket. Use when adding or changing an upload flow (item photos, avatars, QR stickers), when deleting rows that own images, or when an image 404s or fails to display.
---

# JUYO Supabase Storage

Follow [security.rules.md](../../rules/security.rules.md) — the upload section
describes real gaps in the current code that you should not copy forward.

## One bucket

Everything lives in a single public bucket named **`items`**. All 24 call sites
use `.storage.from("items")`. Do not create a second bucket without asking.

Path conventions in use:

```
avatars/<userId>-<timestamp>.<ext>      profile pictures
<item-scoped paths>                     item photos
```

Public URLs come from `getPublicUrl(path)`. Because the bucket is public, the
path *is* the access control — never build a path from user-supplied text.

## Upload

Server-side, via a Route Handler with `supabaseAdmin`:

```ts
const formData = await req.formData();
const file = formData.get("file");
if (!(file instanceof File)) {
  return NextResponse.json({ error: "Файл лозим аст" }, { status: 400 });
}

const { error: uploadError } = await supabaseAdmin.storage
  .from("items")
  .upload(path, file, { contentType: file.type, upsert: true });
if (uploadError) throw uploadError;

const { data } = supabaseAdmin.storage.from("items").getPublicUrl(path);
```

Client-side uploads (`app/(main)/items/add/page.tsx`,
`app/(main)/items/[id]/edit/page.tsx`) use the anon/Clerk client and rely on
storage policies.

## What current code gets wrong — fix, don't copy

`app/api/admin/users/[id]/avatar/route.ts` is the honest baseline, and it is
weak:

- it trusts `file.type` (client-controlled) via `startsWith("image/")`
- it derives the extension from the user-supplied filename:
  `file.name.split(".").pop() || "jpg"`
- it enforces **no size limit**

When you touch an upload path, tighten it:

1. **Size cap** before upload — reject oversized files with 400.
2. **Type allowlist** — `image/jpeg`, `image/png`, `image/webp`. Treat the
   client MIME as a hint only.
3. **Generate the filename yourself.** Map the allowed MIME to an extension;
   never interpolate `file.name` into the path.
4. **Ownership** — confirm the caller owns the target row before writing into
   its prefix. Admin routes check `isAdminUser` first.
5. `upsert: true` overwrites. Be sure that is what you want.

## Cleanup

Storage objects are not removed when a row disappears. Deleting must remove
both, or the bucket fills with orphans.

Reference implementations: `lib/services/item-deletion.ts` and
`lib/services/account-deletion.ts`. Any new hard-delete path must do the same.

Note the split: `ItemService.deleteItem` soft-deletes and leaves images in
place; `hardDeleteItem` removes them. Do not add storage deletion to the soft
path.

## Displaying images

- `next.config.ts` has `images.unoptimized: true` **deliberately** — the Vercel
  optimization quota was exhausted (402) after a bulk import. Do not re-enable
  it as a "performance fix".
- The Supabase hostname is added to `remotePatterns` at runtime from
  `NEXT_PUBLIC_SUPABASE_URL`, scoped to `/storage/v1/object/public/**`. A new
  remote image host must be added there or `next/image` will refuse it.
- Client-side resizing/compression helpers live in `lib/image-utils.ts`
  (covered by `tests/lib/image-utils.test.ts`).

## Moderation

Uploaded images run through the `image-moderation` Edge Function (OpenAI),
triggered from the database. An image can therefore be rejected *after* upload —
UI must handle `moderation_status` pending and rejected, not assume success.

`components/privacy-blur-editor.tsx` pixelates detected document fields before
upload. It fails open on scan error by design.

## Verify

```bash
npx tsc --noEmit
npx vitest run tests/lib/image-utils.test.ts
```

Then upload for real against `npm run dev`: a valid image, an oversized file,
and a non-image with a spoofed extension. Confirm the object is removed when
the owning row is hard-deleted.
