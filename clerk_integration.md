# Clerk + Supabase Integration Guide

Follow these steps to reconnect Clerk and Supabase.

## 1. Clerk Dashboard: Setup JWT Template
The application expects a JWT signed by Clerk to authenticate requests to Supabase.

1.  Log in to **Clerk Dashboard**.
2.  Navigate to **JWT Templates** in the sidebar.
3.  Click **+ New Template** and select **Supabase**.
4.  **Crucial:** Name the template `supabase`. The code uses `getToken({ template: 'supabase' })`.
5.  In the claims editor, ensure it looks like this:
    ```json
    {
      "aud": "authenticated",
      "role": "authenticated",
      "sub": "{{user.id}}"
    }
    ```
6.  Copy the **JWKS Endpoint** or the **Public Key** (PEM) from the template settings.

## 2. Supabase Dashboard: Configure Auth
Supabase needs to know how to verify the Clerk JWT.

1.  Log in to **Supabase Dashboard** and go to your project.
2.  Navigate to **Settings** -> **Authentication**.
3.  Under **JWT Settings**:
    -   **JWT Secret:** Enter the Clerk PEM Public Key (if using PEM) or configure the Clerk JWKS endpoint.
    -   **JWT Algorithm:** Set to `RS256`.
4.  If your version of Supabase supports it, you can also add Clerk as an **OIDC Provider** using the Clerk issuer URL.

## 3. Storage Configuration
1.  Go to **Storage** in Supabase.
2.  Create a bucket named `items`.
3.  Set it to **Public** (required for `getPublicUrl` to work).

## Troubleshooting Common JWT Errors

### "exp" claim timestamp check failed
This error occurs when the JWT token has expired or is considered expired by Supabase.

1.  **Clock Skew (Most Common):** If your computer's clock is even slightly behind the server's clock, the token might be issued with an `exp` time that has already passed according to the server.
    -   **Fix:** Ensure your system time is set to "Update automatically".
    -   **Permanent Fix:** In Clerk Dashboard -> JWT Templates -> `supabase` -> **Token lifetime**, increase the value from `60` to `600` (10 minutes) or more. This provides a buffer for clock differences.
2.  **Long Operations:** If you are uploading multiple large images, the token might expire before the final database update.
    -   **Fix:** The code now re-fetches the token before critical database updates, but increasing the token lifetime in Clerk is still recommended.

### "JWT signature is invalid"
This means Supabase cannot verify the token signed by Clerk.
-   **Fix:** Double-check that you copied the **PEM Public Key** correctly from Clerk to Supabase (Settings -> Auth -> JWT Secret). Ensure the algorithm is set to `RS256`.
