/**
 * Хатогиҳои Clerk одатан ҳамчун { errors: [{ longMessage, message }] } меоянд,
 * на Error оддӣ — ин helper новобаста аз шакли воқеии хатогӣ паёми
 * хониданиро бе `any` мебарорад (барои логгинг ва/ё паёми корбар).
 */
export function getErrorMessage(err: unknown, fallback = "Internal error"): string {
  if (err && typeof err === "object") {
    const e = err as { errors?: { longMessage?: string; message?: string }[]; message?: string; status?: number };
    return e.errors?.[0]?.longMessage || e.errors?.[0]?.message || e.message || fallback;
  }
  return fallback;
}

/** Коди HTTP-и хатогии Clerk (масалан 404), агар мавҷуд бошад. */
export function getErrorStatus(err: unknown): number | undefined {
  if (err && typeof err === "object" && "status" in err) {
    const status = (err as { status?: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
}
