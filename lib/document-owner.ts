/**
 * The owner's name on a Documents or Cards listing (owner decision 2026-10-07): only
 * the first name and the first letter of the surname, e.g. "Алишер Р.".
 * The add/edit screens have a separate field for it; it is saved as the
 * first line of the description ("Соҳиб: Алишер Р."), so search and
 * lost↔found matching find it without a schema change, and the edit screens
 * read it back from there.
 *
 * A Documents listing may also carry the owner's district or street (never a
 * house number — the field says so) as the next line ("Суроға: ноҳияи Сино"),
 * so the real owner can recognise the document. Both lines are drawn on the
 * placeholder image.
 *
 * A listing the admin posts for someone who wrote to JUYO on Instagram belongs
 * to the admin's own account; the person's name is kept the same way, as the
 * very first line ("Instagram: Алишер Раҳимов"), and the listing shows
 * "Аз Instagram-и juyo" with that name instead of the admin's profile.
 *
 * Kept byte-identical in Web/lib and app/lib (app/__tests__/shared-lib-parity.test.ts).
 */
const OWNER_LABELS: Record<string, string> = { tg: 'Соҳиб:', ru: 'Владелец:', en: 'Owner:' };
const ADDRESS_LABELS: Record<string, string> = { tg: 'Суроға:', ru: 'Адрес:', en: 'Address:' };
const LETTER = "\\p{L}";
const SHORT_NAME = new RegExp(`^(${LETTER}[${LETTER}'’-]+)\\s+(${LETTER})\\.?$`, 'u');
const OWNER_LINE = /^(?:Соҳиб|Владелец|Owner):\s*(.+)$/u;
const ADDRESS_LINE = /^(?:Суроға|Адрес|Address):\s*(.+)$/u;
const INSTAGRAM_LINE = /^Instagram:\s*(.+)$/u;
export const OWNER_ADDRESS_MAX = 60;

/** What a listing posted for an Instagram request shows in place of the poster's profile. */
export const INSTAGRAM_POSTER_NAME = 'Аз Instagram-и juyo';
export const INSTAGRAM_POSTER_AVATAR = 'https://juyo.tj/placeholders/instagram.png';

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

/** One line, single spaces, at most OWNER_ADDRESS_MAX characters. */
export function cleanOwnerAddress(input: string | null | undefined): string {
  return (input ?? '').replace(/\s+/g, ' ').trim().slice(0, OWNER_ADDRESS_MAX).trim();
}

/**
 * The description as saved: the owner line, then the address line, then what
 * the person wrote. An "Instagram:" line already on the description is kept.
 */
export function withOwnerLine(description: string, ownerName: string | null, locale: string, address: string | null = null): string {
  const { postedFor, rest } = splitOwnerLine(description);
  const lines: string[] = [];
  if (postedFor) lines.push(`Instagram: ${postedFor}`);
  if (ownerName) lines.push(`${OWNER_LABELS[locale] ?? OWNER_LABELS.tg} ${ownerName}`);
  const place = cleanOwnerAddress(address);
  if (place) lines.push(`${ADDRESS_LABELS[locale] ?? ADDRESS_LABELS.tg} ${place}`);
  return [...lines, rest].join('\n').trim();
}

/** Puts (or replaces) the "Instagram:" line at the top; the owner and address lines stay. */
export function withPostedFor(description: string, person: string): string {
  const name = cleanOwnerAddress(person);
  const body = description.split('\n').filter((line, i) => !(i === 0 && INSTAGRAM_LINE.test(line.trim()))).join('\n').trim();
  return name ? `Instagram: ${name}\n${body}`.trim() : body;
}

/** Reads the leading lines back (in any of the three languages) for the edit and listing screens. */
export function splitOwnerLine(description: string): { postedFor: string; ownerName: string; address: string; rest: string } {
  const lines = description.split('\n');
  let at = 0;
  const posted = INSTAGRAM_LINE.exec((lines[at] ?? '').trim());
  if (posted) at++;
  const owner = OWNER_LINE.exec((lines[at] ?? '').trim());
  if (owner) at++;
  const place = ADDRESS_LINE.exec((lines[at] ?? '').trim());
  if (place) at++;
  if (at === 0) return { postedFor: '', ownerName: '', address: '', rest: description };
  return {
    postedFor: posted ? posted[1].trim() : '',
    ownerName: owner ? owner[1].trim() : '',
    address: place ? place[1].trim() : '',
    rest: lines.slice(at).join('\n').trim(),
  };
}

const NAMED = "(\\p{Lu}[\\p{L}'’-]+)\\s+(\\p{Lu})[\\p{L}'’-]*\\.?";
const NAME_IN_TEXT = new RegExp(`(?:на имя|ба номи|in the name of)\\s+${NAMED}`, 'iu');
const NAME_ONLY = new RegExp(`^${NAMED}$`, 'u');

/**
 * The name drawn on the placeholder picture: the owner line when there is one,
 * otherwise a name the text itself gives ("на имя Махмудов М.", "ба номи
 * Носиров Комилҷон", or a description that is only "Нурахмадов И.") — listings
 * written before the owner field existed. Always word + one initial, never a
 * second full word. Empty when the text names nobody.
 */
export function pictureOwnerName(description: string): string {
  const { ownerName, rest } = splitOwnerLine(description);
  if (ownerName) return ownerName;
  const m = NAME_IN_TEXT.exec(rest) ?? NAME_ONLY.exec(rest.trim());
  return m ? `${m[1]} ${m[2].toLocaleUpperCase()}.` : '';
}
