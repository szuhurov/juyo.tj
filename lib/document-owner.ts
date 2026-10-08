/**
 * The owner's name on a Documents or Cards listing (owner decision 2026-10-07): only
 * the first name and the first letter of the surname, e.g. "Алишер Р.".
 * The add/edit screens have a separate field for it; it is saved as the
 * first line of the description ("Соҳиб: Алишер Р."), so search and
 * lost↔found matching find it without a schema change, and the edit screens
 * read it back from there.
 *
 * Kept byte-identical in Web/lib and app/lib (app/__tests__/shared-lib-parity.test.ts).
 */
const OWNER_LABELS: Record<string, string> = { tg: 'Соҳиб:', ru: 'Владелец:', en: 'Owner:' };
const LETTER = "\\p{L}";
const SHORT_NAME = new RegExp(`^(${LETTER}[${LETTER}'’-]+)\\s+(${LETTER})\\.?$`, 'u');
const OWNER_LINE = /^(?:Соҳиб|Владелец|Owner):\s*(.+)$/u;

export type OwnerNameCheck =
  | { ok: true; value: string }
  | { ok: false; reason: 'full_surname' | 'format' };

/** "алишер р" → "Алишер Р."; a full surname or anything else is refused. Empty input is fine (the field is optional). */
export function checkOwnerName(input: string): OwnerNameCheck | null {
  const raw = input.trim().replace(/\s+/g, ' ');
  if (!raw) return null;
  const m = SHORT_NAME.exec(raw);
  if (m) {
    const first = m[1].charAt(0).toLocaleUpperCase() + m[1].slice(1).toLocaleLowerCase();
    return { ok: true, value: `${first} ${m[2].toLocaleUpperCase()}.` };
  }
  const parts = raw.split(' ');
  if (parts.length >= 2 && parts.slice(1).some((p) => p.replace(/[.\s]/g, '').length > 1)) {
    return { ok: false, reason: 'full_surname' };
  }
  return { ok: false, reason: 'format' };
}

/** The description as saved: the owner line first, then what the person wrote. */
export function withOwnerLine(description: string, ownerName: string | null, locale: string): string {
  const rest = splitOwnerLine(description).rest;
  if (!ownerName) return rest;
  return `${OWNER_LABELS[locale] ?? OWNER_LABELS.tg} ${ownerName}\n${rest}`.trim();
}

/** Reads the owner line back (in any of the three languages) for the edit screens. */
export function splitOwnerLine(description: string): { ownerName: string; rest: string } {
  const [first, ...others] = description.split('\n');
  const m = OWNER_LINE.exec(first.trim());
  if (!m) return { ownerName: '', rest: description };
  return { ownerName: m[1].trim(), rest: others.join('\n').trim() };
}
