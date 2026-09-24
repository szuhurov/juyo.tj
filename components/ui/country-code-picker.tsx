"use client";

import * as React from "react";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { COUNTRIES, flagEmoji, type Country } from "@/lib/countries";
import { useLanguage } from "@/lib/language-context";
import { cn } from "@/lib/utils";

interface CountryCodePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: Country;
  onSelect: (country: Country) => void;
}

export function CountryCodePicker({
  open,
  onOpenChange,
  value,
  onSelect,
}: CountryCodePickerProps) {
  const { t } = useLanguage();
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.dialCode.includes(q),
    );
  }, [query]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setQuery("");
      }}
    >
      <DialogContent className="w-[92%] sm:max-w-sm rounded-[var(--radius-card)] p-0 gap-0 border-none shadow-[var(--shadow-3)] bg-card max-h-[80vh] flex flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle className="text-lg font-semibold tracking-tight">
            {t("selectCountry")}
          </DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-3">
          <div className="flex items-center gap-2 h-11 rounded-[var(--radius-control)] bg-muted px-3">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchCountryPlaceholder")}
              className="flex-1 min-w-0 bg-transparent border-none outline-none text-sm font-medium placeholder:text-muted-foreground"
            />
          </div>
        </div>
        <ScrollArea className="flex-1 px-2 pb-4">
          <div className="flex flex-col">
            {filtered.map((c) => (
              <button
                key={c.iso2}
                type="button"
                onClick={() => {
                  onSelect(c);
                  onOpenChange(false);
                  setQuery("");
                }}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-[var(--radius-control)] text-left hover:bg-accent transition-colors",
                  value.iso2 === c.iso2 && "bg-emerald-50 dark:bg-emerald-900/20",
                )}
              >
                <span className="text-xl leading-none">{flagEmoji(c.iso2)}</span>
                <span className="flex-1 text-sm font-medium text-foreground truncate">
                  {c.name}
                </span>
                <span className="text-sm font-medium text-muted-foreground">
                  +{c.dialCode}
                </span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                {t("countryNoResults")}
              </p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
