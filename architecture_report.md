# Architecture Report - JUYO.TJ Backend Restoration

## 1. Application Overview
JUYO.TJ is a specialized Next.js application for lost and found items in Tajikistan. It integrates **Clerk** for identity management and **Supabase** for data persistence, file storage, and access control.

## 2. Core Data Structures
The following tables were successfully inferred from the codebase:

-   **`profiles`**: Stores user metadata (First/Last name, avatar, phone). The Primary Key is the Clerk User ID.
-   **`items`**: The main repository for posts. Key fields include `type` (lost/found), `moderation_status`, and `is_resolved`.
-   **`item_images`**: A dedicated table for multiple image associations per post.
-   **`saved_items`**: Junction table for user favorites.
-   **`safety_box`**: A private "trash" or "archive" where users move items before final deletion or re-publishing.

## 3. Security & Auth Flow
-   **Clerk-to-Supabase Sync:** The application uses an on-demand sync approach. Profiles are created/updated in Supabase the first time a user interacts with the system via the `MandatoryPhoneModal`.
-   **JWT-Based RLS:** Authorization is handled entirely at the database level. Supabase verifies Clerk's JWT and identifies the user via the `sub` claim.
-   **Policy Logic:** 
    -   `profiles`: Publicly viewable for QR code scanning, but only editable by the owner.
    -   `items`: Only `approved` items are public. `pending` or `rejected` items are restricted to the owner.

## 4. Automation & Logic
-   **Moderation Pipeline:** When an item is created, an API call is made to a serverless function that uses **Sightengine** to check images. The status in the `items` table is updated based on the result.
-   **View Tracking:** A Postgres function `increment_item_views` is used to track post popularity securely.

## 5. Assumptions & Inferences
-   **Clerk IDs as TEXT:** Since Clerk IDs (e.g., `user_2...`) are not UUIDs, all foreign keys in Supabase have been set to `TEXT` to maintain compatibility.
-   **Storage Public Access:** The `items` storage bucket must be public for the `getPublicUrl` method to resolve images correctly.

## 6. Risks & Improvements
-   **Moderation Speed:** Currently, moderation is triggered from the frontend after item creation. A more robust approach would be to use a Supabase Edge Function triggered by a database `INSERT`.
-   **Data Orphans:** `ON DELETE CASCADE` has been added to all foreign keys to ensure that deleting a user or an item removes all associated images and bookmarks.
