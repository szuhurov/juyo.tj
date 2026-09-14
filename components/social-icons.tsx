/**
 * Brand icons for social networks.
 *
 * These aren't flat glyphs, they're APP ICONS: a background in the
 * brand's official color (or gradient), with a white glyph on top —
 * exactly how the user sees them on their phone's home screen. This
 * makes recognition instant: the eye recognizes the network before
 * reading any text.
 *
 * `lucide-react` doesn't have these shapes, and per the project's rules
 * a second icon library can't be added, so all three are kept here as
 * SVG. The glyph paths are EXACTLY the same as the app's version
 * (`juyoapp/components/SocialIcons.tsx`) — any shape change must be made
 * in both files.
 */
import type { SVGProps } from "react";

type IconProps = Omit<SVGProps<SVGSVGElement>, "color"> & { size?: number };

const TELEGRAM_D =
  "M21.94 4.3 19.2 19.1c-.2 1.1-.9 1.37-1.8.85l-4.98-3.67-2.4 2.31c-.27.27-.5.5-1 .5l.35-5.06 9.2-8.31c.4-.36-.09-.56-.62-.2L6.58 12.6l-4.9-1.53c-1.06-.34-1.08-1.07.23-1.58l19.16-7.39c.89-.32 1.66.2 1.37 2.2z";

const INSTAGRAM_D =
  "M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.8 3.8 0 0 1-1.38-.9 3.8 3.8 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zm0 1.98c-3.14 0-3.51.01-4.75.07-1.15.05-1.77.24-2.18.4-.55.22-.94.47-1.35.88-.41.41-.66.8-.88 1.35-.16.41-.35 1.03-.4 2.18-.06 1.24-.07 1.61-.07 4.75s.01 3.51.07 4.75c.05 1.15.24 1.77.4 2.18.22.55.47.94.88 1.35.41.41.8.66 1.35.88.41.16 1.03.35 2.18.4 1.24.06 1.61.07 4.75.07s3.51-.01 4.75-.07c1.15-.05 1.77-.24 2.18-.4.55-.22.94-.47 1.35-.88.41-.41.66-.8.88-1.35.16-.41.35-1.03.4-2.18.06-1.24.07-1.61.07-4.75s-.01-3.51-.07-4.75c-.05-1.15-.24-1.77-.4-2.18a3.6 3.6 0 0 0-.88-1.35 3.6 3.6 0 0 0-1.35-.88c-.41-.16-1.03-.35-2.18-.4-1.24-.06-1.61-.07-4.75-.07zm0 3.37a4.49 4.49 0 1 1 0 8.98 4.49 4.49 0 0 1 0-8.98zm0 7.4a2.91 2.91 0 1 0 0-5.82 2.91 2.91 0 0 0 0 5.82zm5.72-7.6a1.05 1.05 0 1 1-2.1 0 1.05 1.05 0 0 1 2.1 0z";

const WHATSAPP_D =
  "M17.5 14.38c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.48-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47s1.06 2.87 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35zM12.05 21.7h-.02a9.6 9.6 0 0 1-4.88-1.34l-.35-.2-3.63.95.97-3.54-.23-.36a9.58 9.58 0 0 1-1.47-5.12c0-5.3 4.32-9.6 9.62-9.6a9.55 9.55 0 0 1 6.8 2.82 9.5 9.5 0 0 1 2.81 6.79c0 5.3-4.32 9.6-9.62 9.6zM20.5 3.49A11.48 11.48 0 0 0 12.05 0C5.68 0 .49 5.18.49 11.55c0 2.04.53 4.02 1.55 5.78L.39 24l6.83-1.79a11.5 11.5 0 0 0 5.22 1.26h.01c6.37 0 11.56-5.18 11.56-11.55 0-3.09-1.2-5.99-3.39-8.17z";

const FACEBOOK_D =
  "M15.12 22.5v-8.16h2.74l.41-3.18h-3.15V9.13c0-.92.26-1.55 1.58-1.55h1.68V4.73c-.29-.04-1.29-.13-2.45-.13-2.43 0-4.09 1.48-4.09 4.2v2.36H9.09v3.18h2.75v8.16h3.28z";

const svgBase = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  "aria-hidden": true as const,
  focusable: "false" as const,
});

/**
 * Glyph centered on the icon, smaller than the background.
 *
 * `cx`/`cy` is the path's ACTUAL center, not the center of the 24×24
 * box: the Telegram paper plane sits slightly up-left of center, and
 * without this correction it looked off-center within the circle.
 */
const glyph = (scale: number, cx = 12, cy = 12) =>
  `translate(12 12) scale(${scale}) translate(${-cx} ${-cy})`;

export function TelegramIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg {...svgBase(size)} {...props}>
      <defs>
        <linearGradient id="juyo-tg-bg" x1="12" y1="0" x2="12" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2AABEE" />
          <stop offset="1" stopColor="#229ED9" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="12" fill="url(#juyo-tg-bg)" />
      <path d={TELEGRAM_D} fill="#fff" transform={glyph(0.6, 11.6, 11.2)} />
    </svg>
  );
}

export function InstagramIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg {...svgBase(size)} {...props}>
      <defs>
        {/* Instagram's official gradient — from bottom-left to top-right corner. */}
        <linearGradient id="juyo-ig-bg" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FEDA75" />
          <stop offset="0.25" stopColor="#FA7E1E" />
          <stop offset="0.5" stopColor="#D62976" />
          <stop offset="0.75" stopColor="#962FBF" />
          <stop offset="1" stopColor="#4F5BD5" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="7" fill="url(#juyo-ig-bg)" />
      <path d={INSTAGRAM_D} fill="#fff" transform={glyph(0.66)} />
    </svg>
  );
}

export function WhatsappIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg {...svgBase(size)} {...props}>
      <circle cx="12" cy="12" r="12" fill="#25D366" />
      <path d={WHATSAPP_D} fill="#fff" transform={glyph(0.62)} />
    </svg>
  );
}

export function FacebookIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg {...svgBase(size)} {...props}>
      <circle cx="12" cy="12" r="12" fill="#1877F2" />
      {/* The "f" letter is already centered in the box and at the right
          size — unlike the other three, no scale is needed here. */}
      <path d={FACEBOOK_D} fill="#fff" />
    </svg>
  );
}

/** A single order — used both in the form and on the scan page. */
export const SOCIALS = [
  { key: "telegram", Icon: TelegramIcon, label: "Telegram" },
  { key: "instagram", Icon: InstagramIcon, label: "Instagram" },
  { key: "whatsapp", Icon: WhatsappIcon, label: "WhatsApp" },
  { key: "facebook", Icon: FacebookIcon, label: "Facebook" },
] as const;

export type SocialKey = (typeof SOCIALS)[number]["key"];

/**
 * Display prefix shown at the start of the field.
 *
 * It is NOT INCLUDED in the value — it's only displayed, so the user
 * knows what they're typing:
 *
 *   Instagram → always `@`
 *   WhatsApp  → always `+` (numbers only)
 *   Telegram  → either possible: a number → `+`, a name → `@`
 *
 * While Telegram is empty, no prefix is shown, but its space is still
 * reserved — otherwise the text would suddenly jump sideways the moment
 * the first character is typed.
 */
export function socialPrefix(key: SocialKey, value: string): string {
  if (key === "instagram") return "@";
  if (key === "whatsapp") return "+";
  // Facebook has no prefix — its URL is `facebook.com/<name>`.
  if (key === "facebook") return "";
  if (!value) return "";
  return /^\d/.test(value) ? "+" : "@";
}

/**
 * Strips prefix characters while typing.
 *
 * Without this, if the user typed `@` or `+` themselves, the screen
 * would show two characters (`@@name`) and the database would also end
 * up storing a dirty value.
 */
export function stripSocialPrefix(value: string): string {
  return value.replace(/^[@+\s]+/, "");
}

/**
 * Strips disallowed characters WHILE typing.
 *
 * Each network has its own rules, and none of them accept a space — a
 * `_` or `.` goes there instead:
 *
 *   telegram  — letters, digits, `_`. No dot. Up to 32.
 *               (a phone number also goes through here — digits only)
 *   instagram — letters, digits, `.`, `_`. Up to 30.
 *   facebook  — letters, digits, `.`. No underscore. Up to 50.
 *   whatsapp  — digits ONLY. Up to 20.
 *
 * Sanitizing exactly while typing matters, not on save: if the user
 * types a space and we silently drop it later, they won't understand
 * why the link doesn't work.
 */
export function sanitizeSocialInput(key: SocialKey, value: string): string {
  const v = stripSocialPrefix(value);
  if (key === "whatsapp") return v.replace(/\D/g, "").slice(0, 20);
  if (key === "telegram") return v.replace(/[^A-Za-z0-9_]/g, "").slice(0, 32);
  if (key === "facebook") return v.replace(/[^A-Za-z0-9.]/g, "").slice(0, 50);
  return v.replace(/[^A-Za-z0-9._]/g, "").slice(0, 30);
}

/**
 * Builds a reliable link from whatever the user typed.
 *
 * Users typically type `@name`, a full link, or just the name — we
 * normalize all three forms into one. Returning `null` means "don't
 * render": better to not show the icon at all than link to a
 * non-existent page.
 */
export function socialHref(key: SocialKey, raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;

  if (key === "whatsapp") {
    const digits = v.replace(/\D/g, "");
    return digits.length >= 9 ? `https://wa.me/${digits}` : null;
  }

  // Strip the username of `@`, the full link, and trailing slashes.
  const handle = v
    .replace(
      /^https?:\/\/(www\.)?(t\.me|telegram\.me|instagram\.com|facebook\.com|fb\.com)\//i,
      "",
    )
    .replace(/^[@+]/, "")
    .replace(/\/+$/, "")
    .split(/[/?#]/)[0];

  if (key === "telegram") {
    /**
     * Telegram accepts BOTH a phone number and a nickname.
     *
     * Telling them apart is easy: a Telegram nickname can never consist
     * of digits only — it must contain a letter. So if it's all digits,
     * it's a phone number, and Telegram wants the `t.me/+<number>` form
     * for that (the "+" character is required).
     */
    if (/^\d+$/.test(handle)) {
      return handle.length >= 9 ? `https://t.me/+${handle}` : null;
    }
    return /^[A-Za-z0-9_]{5,32}$/.test(handle) ? `https://t.me/${handle}` : null;
  }

  if (key === "facebook") {
    // A Facebook name may contain a dot and can be up to 50 characters.
    return /^[A-Za-z0-9.]{3,50}$/.test(handle)
      ? `https://facebook.com/${handle}`
      : null;
  }

  return /^[A-Za-z0-9._]{1,30}$/.test(handle)
    ? `https://instagram.com/${handle}`
    : null;
}
