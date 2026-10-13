/**
 * The pages that render one of Clerk's prebuilt screens (<SignIn>, <SignUp>,
 * <UserProfile>). Only these load Clerk's UI bundle — see
 * components/clerk-localization-provider.tsx. A new page that uses a Clerk
 * component must be added here, or the component will not appear.
 */
const CLERK_UI_PATHS = /^\/(?:sign-in|sign-up|profile\/edit)(?:\/|$)/;

export function clerkNeedsUi(pathname: string | null | undefined): boolean {
  return !!pathname && CLERK_UI_PATHS.test(pathname);
}
