"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { Download, Loader2, Phone } from "lucide-react";
import { SOCIALS, socialPrefix, type SocialKey } from "@/components/social-icons";

interface Props {
  name: string;
  avatarUrl: string | null;
  phone: string | null;
  secondaryPhone: string | null;
  socials: Partial<Record<SocialKey, string | null | undefined>>;
  labels: {
    save: string;
    saved: string;
    error: string;
    contactOwner: string;
    contactSecondary: string;
  };
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  minHeight: 56,
  padding: "8px 14px",
  borderRadius: 12,
  background: "#ffffff",
};

/**
 * "Save to gallery" button — builds a FULL image with complete
 * information (WITHOUT masking) and exports it to the device's gallery.
 *
 * The on-screen mask (last 5 digits → dots, see page.tsx) is only to
 * defeat HTML scraper READING — the action here is the user's own
 * EXPLICIT choice (they press "Save" themselves), so the card is built
 * with the FULL number, otherwise saving it would be pointless.
 */
export function QrSaveContactButton({
  name,
  avatarUrl,
  phone,
  secondaryPhone,
  socials,
  labels,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!cardRef.current || saving) return;
    setSaving(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 50));
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 3,
        skipFonts: false,
      });

      const link = document.createElement("a");
      link.download = "juyo-contact.png";
      link.href = dataUrl;
      link.click();
      toast.success(labels.saved);
    } catch (err) {
      console.error("Save contact error:", err);
      toast.error(labels.error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center justify-center gap-3 w-full min-h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-normal transition-transform active:scale-[0.98] disabled:opacity-60 shrink-0"
      >
        {saving ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        <span>{labels.save}</span>
      </button>

      {/* Off-screen — only the image source for html-to-image. */}
      <div
        aria-hidden
        style={{ position: "fixed", top: 0, left: -9999, pointerEvents: "none" }}
      >
        <div
          ref={cardRef}
          style={{
            width: 360,
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            background: "#f1f5f9",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              marginBottom: 8,
            }}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- html-to-image capture source, not a regular site render
              <img
                src={avatarUrl}
                crossOrigin="anonymous"
                width={96}
                height={96}
                style={{
                  borderRadius: 9999,
                  objectFit: "cover",
                  border: "4px solid #ffffff",
                }}
                alt=""
              />
            ) : (
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 9999,
                  background: "#e4e4e7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 32,
                  fontWeight: 700,
                  color: "#a1a1aa",
                }}
              >
                {name.charAt(0)}
              </div>
            )}
            <div
              style={{
                marginTop: 12,
                fontSize: 18,
                fontWeight: 700,
                color: "#18181b",
              }}
            >
              {name}
            </div>
          </div>

          {phone && (
            <div style={rowStyle}>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 34,
                  height: 34,
                  borderRadius: 9999,
                  background: "#25D366",
                  flexShrink: 0,
                }}
              >
                <Phone size={18} color="#ffffff" />
              </span>
              <div>
                <div style={{ fontSize: 14, color: "#18181b" }}>{labels.contactOwner}</div>
                <div style={{ fontSize: 12, color: "#a1a1aa" }}>{phone}</div>
              </div>
            </div>
          )}

          {secondaryPhone && (
            <div style={rowStyle}>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 34,
                  height: 34,
                  borderRadius: 9999,
                  background: "#25D366",
                  flexShrink: 0,
                }}
              >
                <Phone size={18} color="#ffffff" />
              </span>
              <div>
                <div style={{ fontSize: 14, color: "#18181b" }}>{labels.contactSecondary}</div>
                <div style={{ fontSize: 12, color: "#a1a1aa" }}>{secondaryPhone}</div>
              </div>
            </div>
          )}

          {SOCIALS.map((s) => {
            const raw = (socials[s.key] ?? "").trim();
            if (!raw) return null;
            const Icon = s.Icon;
            return (
              <div key={s.key} style={rowStyle}>
                <Icon size={34} />
                <div>
                  <div style={{ fontSize: 14, color: "#18181b" }}>{s.label}</div>
                  <div style={{ fontSize: 12, color: "#a1a1aa" }}>
                    {socialPrefix(s.key, raw) + raw}
                  </div>
                </div>
              </div>
            );
          })}

          <div style={{ textAlign: "center", fontSize: 11, color: "#a1a1aa", marginTop: 8 }}>
            JUYO.TJ
          </div>
        </div>
      </div>
    </>
  );
}
