import { redirect } from "next/navigation";

export default function QRRedirectPage() {
  redirect("/profile?tab=qr");
}
