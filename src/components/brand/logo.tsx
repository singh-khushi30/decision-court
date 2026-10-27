import { Scale } from "lucide-react";
import Link from "next/link";

export function Logo() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2 rounded-full text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass"
    >
      <Scale className="size-4" aria-hidden="true" />
      <span className="font-serif text-[1.35rem] leading-none font-medium tracking-tight">
        Decision Court
      </span>
    </Link>
  );
}
