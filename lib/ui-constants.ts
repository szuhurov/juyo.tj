/**
 * Uniform grid for item cards (ItemCard) — used everywhere a listing
 * list shows a grid of cards (home, profile posts/saved, my-posts), so
 * the layout is consistent everywhere.
 *
 * auto-fill + minmax() was chosen instead of a fixed column count (e.g.
 * "md:grid-cols-4"): the column count automatically increases/decreases
 * to match the actually available space — not a sudden "jump" at a
 * single breakpoint (e.g. from 2 columns straight to 4), but a smooth
 * increase. The lower bound (minmax min) at each tier keeps the card
 * size from ever getting too small, and `1fr` (rather than a fixed upper
 * bound/px) guarantees there's no empty horizontal space — the existing
 * columns stretch to fill it.
 */
export const ITEM_GRID_CLASS =
  "grid gap-2 sm:gap-3 md:gap-3 lg:gap-4 xl:gap-5 " +
  "grid-cols-[repeat(auto-fill,minmax(140px,1fr))] " +
  "sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] " +
  "md:grid-cols-[repeat(auto-fill,minmax(175px,1fr))] " +
  "lg:grid-cols-[repeat(auto-fill,minmax(195px,1fr))] " +
  "xl:grid-cols-[repeat(auto-fill,minmax(210px,1fr))] " +
  "2xl:grid-cols-[repeat(auto-fill,minmax(225px,1fr))]";

/**
 * The grid for the HOME page — has a FIXED column count (2 on mobile), as
 * opposed to the auto-fill ITEM_GRID_CLASS.
 *
 * This constant is deliberately kept separate so that the skeleton and the
 * actual list are ALWAYS identical — previously loading.tsx used a
 * different ITEM_GRID_CLASS and the layout jumped once the data arrived.
 *
 * The TIERS are pinned to Tailwind's STANDARD breakpoints and stop at 5
 * columns. The earlier tiers (855/1503/1920) don't work: the content is
 * now capped at `max-w-7xl` (1280px), so on a 1920px monitor 6 columns
 * would get squeezed into that same 1280px and the cards would become
 * tiny. Now, from `md` up, the card width stays nearly constant at ~232px:
 *
 *   md  (768)  3 columns → (768-32-32)/3  ≈ 234px
 *   lg  (1024) 4 columns → (1024-40-60)/4 ≈ 231px
 *   xl  (1280) 5 columns → (1280-40-80)/5 ≈ 232px
 */
export const HOME_GRID_CLASS =
  "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 " +
  // The gap between cards at each tier matches the side padding
  // (`px-2.5 sm:px-4 lg:px-5` in home-client and loading): 10/16/20px.
  // If one is changed, the other must be changed too.
  "gap-2.5 sm:gap-4 lg:gap-5";

/**
 * FALLBACK top padding for the home page content.
 *
 * These numbers are used ONLY as a fallback for the very first render
 * moment (before home-client.tsx's JS measures the ACTUAL height of the
 * fixed bar with `ResizeObserver`) — see `filterBarHeight` there.
 * The move from a hardcoded number to live measurement happened precisely
 * because the hardcoded number came out WRONG twice: once there was too
 * much empty space, another time the quick-action buttons got hidden
 * underneath the bar.
 *
 * `HomeFiltersSkeleton` also uses this same value (there, JS hasn't
 * started measuring yet).
 *
 * BUG FOUND (user report: "the skeleton's top corner isn't rounded, as if
 * something is covering it"): the previous numbers (76/92) were 4px less
 * than the actual height of `HomeFiltersSkeleton` — the math: py-1.5(6)
 * + category row(28/36) + type row(mt-1.5(6)+28/36+mb-1.5(6))
 * + py-1.5(6) = 80px (mobile) / 96px (md+), not 76/92. That missing
 * 4px caused the filter bar (fixed, solid background) to slightly cover
 * the first row of cards — making the rounded corner look cut off.
 */
export const HOME_CONTENT_PT =
  "pt-[80px] min-[768px]:pt-[96px]";

/**
 * Communication between the "add listing" page and the listing list.
 *
 * "Done" navigates to the profile IMMEDIATELY — the listing is still
 * being saved in the background and may finish only after the navigation.
 * So the new listing's id is announced via an event (if the list is
 * already open) and simultaneously written to sessionStorage (in case the
 * list is opened later). The list picks it up and shows a verification
 * countdown on top of that same card.
 */
export const JUST_PUBLISHED_EVENT = "juyo-item-published";
export const JUST_PUBLISHED_KEY = "juyo-just-published";

/** The countdown is tied to `startedAt`, not to the moment the card
 *  appears — otherwise it would restart from 10 after the images finish
 *  uploading (3-5 seconds), even though verification had already started
 *  long before. */
export const PUBLISH_COUNTDOWN_SECONDS = 10;
export const PUBLISH_COUNTDOWN_MS = PUBLISH_COUNTDOWN_SECONDS * 1000;

export interface JustPublishedState {
  /** Unknown until the save completes. */
  id?: string;
  /** The moment "Publish" was pressed (Date.now()). */
  startedAt: number;
}
