import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/admin-auth";

// Only tells the user themselves whether they are an admin or not (for the UI —
// e.g. showing the "Admin" item in the profile menu). It returns no
// sensitive data, so the concealing 404 (like other admin routes use) isn't needed.
export async function GET() {
  const { userId } = await auth();
  return NextResponse.json({ isAdmin: isAdminUser(userId) });
}
