/**
 * Who may post a "Found" listing (owner decisions 2026-10-13 and 2026-10-17).
 * A "Found" post can be used to trick people (fake finders asking for money,
 * fake owners claiming valuables), so:
 *   - accounts the owner verified (companies, authorities) — any category;
 *   - everyone else — keys only.
 * A listing that is already "Found" keeps that type when edited.
 * The database enforces the same rule (items_found_only_verified, migration
 * 20261017000000_found_keys_for_everyone).
 *
 * Kept byte-identical in Web/lib and app/lib (app/__tests__/shared-lib-parity.test.ts).
 */
export const FOUND_FOR_EVERYONE: readonly string[] = ['Keys'];

export function canPostFound(category: string | null | undefined, verified: boolean): boolean {
  return verified || (!!category && FOUND_FOR_EVERYONE.includes(category));
}

/** On edit: may this listing be saved as "Found" in this category? */
export function canKeepFound(
  category: string | null | undefined,
  verified: boolean,
  original: { type?: string | null; category?: string | null } | null | undefined,
): boolean {
  if (canPostFound(category, verified)) return true;
  return original?.type === 'found' && original?.category === category;
}
