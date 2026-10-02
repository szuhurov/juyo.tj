/**
 * COMPATIBILITY STUB — no AI. JUYO removed all AI on 2026-10-01 (App Store
 * 5.1.2(i)); this function used to be where listing text was sent to OpenAI for moderation.
 *
 * Mobile builds released before that date still call it (editing a listing,
 * or after posting). It now only answers "ok" so those builds keep working,
 * without reading the request body, storing anything or calling any external
 * service. Listings are moderated by an admin instead.
 *
 * Delete this function (supabase functions delete text-moderation) once the minimum
 * supported app version no longer calls it.
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return new Response(JSON.stringify({ is_safe: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});
