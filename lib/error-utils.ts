/**
 * Clerk errors usually come as { errors: [{ longMessage, message }] },
 * not a plain Error — this helper extracts a readable message regardless
 * of the actual error shape, without `any` (for logging and/or user-facing messages).
 */
export function getErrorMessage(err: unknown, fallback = "Internal error"): string {
  if (err && typeof err === "object") {
    const e = err as { errors?: { longMessage?: string; message?: string }[]; message?: string; status?: number };
    return e.errors?.[0]?.longMessage || e.errors?.[0]?.message || e.message || fallback;
  }
  return fallback;
}

/** The HTTP status code of a Clerk error (e.g. 404), if present. */
export function getErrorStatus(err: unknown): number | undefined {
  if (err && typeof err === "object" && "status" in err) {
    const status = (err as { status?: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
}
