"use client";

/**
 * Phone field with a flag + dial-code prefix button that opens
 * `CountryCodePicker`, plus the plain national-number `<input>` itself.
 * Selecting a country only changes the displayed prefix and the digit-length
 * cap — the submitted value stays the national number, same as before this
 * component existed, so it's a drop-in replacement for a plain `<Input>`
 * wherever a phone number is collected (works with both controlled
 * value/onChange and uncontrolled name/defaultValue + FormData usage).
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { COUNTRIES, DEFAULT_COUNTRY, findCountry, flagEmoji } from "@/lib/countries";
import { CountryCodePicker } from "@/components/ui/country-code-picker";

export interface PhoneInputProps
  extends Omit<React.ComponentProps<"input">, "type"> {
  defaultCountryIso2?: string;
  containerClassName?: string;
}

export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  function PhoneInput(
    { defaultCountryIso2, containerClassName, className, maxLength, onChange, ...props },
    ref,
  ) {
    const [country, setCountry] = React.useState(
      () => (defaultCountryIso2 ? findCountry(defaultCountryIso2) : DEFAULT_COUNTRY),
    );
    const [pickerOpen, setPickerOpen] = React.useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      e.target.value = e.target.value.replace(/[^0-9]/g, "").slice(0, country.nsnLength);
      onChange?.(e);
    };

    return (
      <div
        className={cn(
          "flex items-center gap-2 h-12 rounded-md bg-slate-50 dark:bg-zinc-800 px-3 has-[input:focus]:ring-2 has-[input:focus]:ring-emerald-500 transition-all",
          containerClassName,
        )}
      >
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-1.5 shrink-0 h-full pr-2.5 border-r border-slate-200 dark:border-zinc-700"
        >
          <span className="text-base leading-none">{flagEmoji(country.iso2)}</span>
          <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            +{country.dialCode}
          </span>
        </button>
        <input
          ref={ref}
          type="tel"
          inputMode="numeric"
          className={cn(
            "flex-1 min-w-0 bg-transparent border-none outline-none font-semibold text-lg tracking-wider text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 placeholder:font-normal placeholder:text-base",
            className,
          )}
          maxLength={maxLength ?? country.nsnLength}
          onChange={handleChange}
          {...props}
        />
        <CountryCodePicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          value={country}
          onSelect={setCountry}
        />
      </div>
    );
  },
);

export { COUNTRIES };
