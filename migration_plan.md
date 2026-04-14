# Migration & Deployment Plan

Follow these steps to deploy your restored backend for **JUYO.TJ**.

## Phase 1: Supabase Setup
1.  **Create Project:** Create a fresh project in the Supabase Dashboard.
2.  **Schema Execution:**
    -   Go to **SQL Editor**.
    -   Create a **New Query**.
    -   Paste and run the contents of `schema.sql`.
3.  **Security Policies:**
    -   Create another **New Query**.
    -   Paste and run the contents of `rls_policies.sql`.
4.  **Storage:**
    -   Go to **Storage**.
    -   Create a new bucket named `items`.
    -   Enable **Public Access**.

## Phase 2: Clerk Connection
1.  **JWT Template:** Follow the steps in `clerk_integration.md` to create a `supabase` template in Clerk.
2.  **Supabase Auth:** Add the Clerk public key to Supabase's JWT configuration.

## Phase 3: Application Update
1.  **Environment Variables:** Update your `.env.local` or Vercel dashboard with the new `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2.  **API Keys:** Ensure `SUPABASE_SERVICE_ROLE_KEY` is set for the moderation functionality.

## Phase 4: Verification & Go-Live
1.  **Test Login:** Sign in to the app. Check the `profiles` table in Supabase.
2.  **Test Upload:** Add a lost/found item. Verify:
    -   Item is created in `items`.
    -   Images are uploaded to the `items` storage bucket.
    -   Moderation updates the status from `pending` to `approved` (if Sightengine is configured).
3.  **Test Public View:** Visit the item page without being logged in (or in Incognito). Verify the item is visible.
