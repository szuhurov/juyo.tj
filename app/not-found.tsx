import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h2 className="text-2xl font-semibold">404</h2>
      <p className="text-muted-foreground">Саҳифа ёфт нашуд</p>
      <Button asChild>
        <Link href="/">Саҳифаи асосӣ</Link>
      </Button>
    </div>
  );
}
