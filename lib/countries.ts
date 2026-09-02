/**
 * Country list for the phone country-code picker (`CountryCodePicker`/
 * `PhoneInput`). No external package — the flag is built from `iso2` via the
 * Unicode "regional indicator symbol" trick (two ISO 3166-1 alpha-2 letters
 * -> two regional-indicator emoji), so no image/extra dependency is needed.
 *
 * `nsnLength` is the approximate length of the national number (without the
 * country code) — used only for a simple `maxLength` cap, not full E.164
 * validation. Selecting a country here is purely cosmetic: it never changes
 * the value submitted by the surrounding form, which stays the plain
 * national-number string it already was.
 */
export type Country = {
  iso2: string;
  name: string;
  dialCode: string;
  nsnLength: number;
};

export function flagEmoji(iso2: string): string {
  return iso2
    .toUpperCase()
    .split("")
    .map((ch) => String.fromCodePoint(127397 + ch.charCodeAt(0)))
    .join("");
}

export const COUNTRIES: Country[] = [
  { iso2: "TJ", name: "Tajikistan", dialCode: "992", nsnLength: 9 },
  { iso2: "RU", name: "Russia", dialCode: "7", nsnLength: 10 },
  { iso2: "UZ", name: "Uzbekistan", dialCode: "998", nsnLength: 9 },
  { iso2: "KZ", name: "Kazakhstan", dialCode: "7", nsnLength: 10 },
  { iso2: "KG", name: "Kyrgyzstan", dialCode: "996", nsnLength: 9 },
  { iso2: "TM", name: "Turkmenistan", dialCode: "993", nsnLength: 8 },
  { iso2: "AF", name: "Afghanistan", dialCode: "93", nsnLength: 9 },
  { iso2: "AZ", name: "Azerbaijan", dialCode: "994", nsnLength: 9 },
  { iso2: "AM", name: "Armenia", dialCode: "374", nsnLength: 8 },
  { iso2: "GE", name: "Georgia", dialCode: "995", nsnLength: 9 },
  { iso2: "BY", name: "Belarus", dialCode: "375", nsnLength: 9 },
  { iso2: "UA", name: "Ukraine", dialCode: "380", nsnLength: 9 },
  { iso2: "MD", name: "Moldova", dialCode: "373", nsnLength: 8 },
  { iso2: "TR", name: "Turkey", dialCode: "90", nsnLength: 10 },
  { iso2: "IR", name: "Iran", dialCode: "98", nsnLength: 10 },
  { iso2: "PK", name: "Pakistan", dialCode: "92", nsnLength: 10 },
  { iso2: "IN", name: "India", dialCode: "91", nsnLength: 10 },
  { iso2: "CN", name: "China", dialCode: "86", nsnLength: 11 },
  { iso2: "MN", name: "Mongolia", dialCode: "976", nsnLength: 8 },
  { iso2: "JP", name: "Japan", dialCode: "81", nsnLength: 10 },
  { iso2: "KR", name: "South Korea", dialCode: "82", nsnLength: 10 },
  { iso2: "AE", name: "United Arab Emirates", dialCode: "971", nsnLength: 9 },
  { iso2: "SA", name: "Saudi Arabia", dialCode: "966", nsnLength: 9 },
  { iso2: "QA", name: "Qatar", dialCode: "974", nsnLength: 8 },
  { iso2: "KW", name: "Kuwait", dialCode: "965", nsnLength: 8 },
  { iso2: "OM", name: "Oman", dialCode: "968", nsnLength: 8 },
  { iso2: "BH", name: "Bahrain", dialCode: "973", nsnLength: 8 },
  { iso2: "IL", name: "Israel", dialCode: "972", nsnLength: 9 },
  { iso2: "JO", name: "Jordan", dialCode: "962", nsnLength: 9 },
  { iso2: "LB", name: "Lebanon", dialCode: "961", nsnLength: 8 },
  { iso2: "IQ", name: "Iraq", dialCode: "964", nsnLength: 10 },
  { iso2: "SY", name: "Syria", dialCode: "963", nsnLength: 9 },
  { iso2: "EG", name: "Egypt", dialCode: "20", nsnLength: 10 },
  { iso2: "GB", name: "United Kingdom", dialCode: "44", nsnLength: 10 },
  { iso2: "DE", name: "Germany", dialCode: "49", nsnLength: 11 },
  { iso2: "FR", name: "France", dialCode: "33", nsnLength: 9 },
  { iso2: "IT", name: "Italy", dialCode: "39", nsnLength: 10 },
  { iso2: "ES", name: "Spain", dialCode: "34", nsnLength: 9 },
  { iso2: "PT", name: "Portugal", dialCode: "351", nsnLength: 9 },
  { iso2: "NL", name: "Netherlands", dialCode: "31", nsnLength: 9 },
  { iso2: "BE", name: "Belgium", dialCode: "32", nsnLength: 9 },
  { iso2: "CH", name: "Switzerland", dialCode: "41", nsnLength: 9 },
  { iso2: "AT", name: "Austria", dialCode: "43", nsnLength: 10 },
  { iso2: "SE", name: "Sweden", dialCode: "46", nsnLength: 9 },
  { iso2: "NO", name: "Norway", dialCode: "47", nsnLength: 8 },
  { iso2: "DK", name: "Denmark", dialCode: "45", nsnLength: 8 },
  { iso2: "FI", name: "Finland", dialCode: "358", nsnLength: 9 },
  { iso2: "PL", name: "Poland", dialCode: "48", nsnLength: 9 },
  { iso2: "CZ", name: "Czechia", dialCode: "420", nsnLength: 9 },
  { iso2: "SK", name: "Slovakia", dialCode: "421", nsnLength: 9 },
  { iso2: "HU", name: "Hungary", dialCode: "36", nsnLength: 9 },
  { iso2: "RO", name: "Romania", dialCode: "40", nsnLength: 9 },
  { iso2: "BG", name: "Bulgaria", dialCode: "359", nsnLength: 9 },
  { iso2: "GR", name: "Greece", dialCode: "30", nsnLength: 10 },
  { iso2: "RS", name: "Serbia", dialCode: "381", nsnLength: 9 },
  { iso2: "HR", name: "Croatia", dialCode: "385", nsnLength: 9 },
  { iso2: "IE", name: "Ireland", dialCode: "353", nsnLength: 9 },
  { iso2: "IS", name: "Iceland", dialCode: "354", nsnLength: 7 },
  { iso2: "LT", name: "Lithuania", dialCode: "370", nsnLength: 8 },
  { iso2: "LV", name: "Latvia", dialCode: "371", nsnLength: 8 },
  { iso2: "EE", name: "Estonia", dialCode: "372", nsnLength: 8 },
  { iso2: "US", name: "United States", dialCode: "1", nsnLength: 10 },
  { iso2: "CA", name: "Canada", dialCode: "1", nsnLength: 10 },
  { iso2: "MX", name: "Mexico", dialCode: "52", nsnLength: 10 },
  { iso2: "BR", name: "Brazil", dialCode: "55", nsnLength: 11 },
  { iso2: "AR", name: "Argentina", dialCode: "54", nsnLength: 10 },
  { iso2: "CL", name: "Chile", dialCode: "56", nsnLength: 9 },
  { iso2: "CO", name: "Colombia", dialCode: "57", nsnLength: 10 },
  { iso2: "PE", name: "Peru", dialCode: "51", nsnLength: 9 },
  { iso2: "AU", name: "Australia", dialCode: "61", nsnLength: 9 },
  { iso2: "NZ", name: "New Zealand", dialCode: "64", nsnLength: 9 },
  { iso2: "ZA", name: "South Africa", dialCode: "27", nsnLength: 9 },
  { iso2: "NG", name: "Nigeria", dialCode: "234", nsnLength: 10 },
  { iso2: "KE", name: "Kenya", dialCode: "254", nsnLength: 9 },
  { iso2: "MA", name: "Morocco", dialCode: "212", nsnLength: 9 },
  { iso2: "DZ", name: "Algeria", dialCode: "213", nsnLength: 9 },
  { iso2: "TN", name: "Tunisia", dialCode: "216", nsnLength: 8 },
  { iso2: "ET", name: "Ethiopia", dialCode: "251", nsnLength: 9 },
  { iso2: "TH", name: "Thailand", dialCode: "66", nsnLength: 9 },
  { iso2: "VN", name: "Vietnam", dialCode: "84", nsnLength: 9 },
  { iso2: "ID", name: "Indonesia", dialCode: "62", nsnLength: 11 },
  { iso2: "MY", name: "Malaysia", dialCode: "60", nsnLength: 9 },
  { iso2: "SG", name: "Singapore", dialCode: "65", nsnLength: 8 },
  { iso2: "PH", name: "Philippines", dialCode: "63", nsnLength: 10 },
  { iso2: "BD", name: "Bangladesh", dialCode: "880", nsnLength: 10 },
  { iso2: "LK", name: "Sri Lanka", dialCode: "94", nsnLength: 9 },
  { iso2: "NP", name: "Nepal", dialCode: "977", nsnLength: 10 },
];

export const DEFAULT_COUNTRY: Country = COUNTRIES[0];

export function findCountry(iso2: string): Country {
  return COUNTRIES.find((c) => c.iso2 === iso2) ?? DEFAULT_COUNTRY;
}
