import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const links = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#examples", label: "Examples" },
  { href: "#about", label: "About" },
];

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-8 gap-y-4 px-5 py-5 sm:px-8 lg:py-7">
      <Logo />
      <nav
        aria-label="Primary"
        className="order-3 flex w-full items-center gap-x-6 gap-y-2 text-sm text-espresso/80 md:order-none md:w-auto md:flex-1 md:justify-center"
      >
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="rounded-full transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass"
          >
            {link.label}
          </a>
        ))}
      </nav>
      <Link
        href="/decide"
        className="ml-auto inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-sm font-medium text-parchment transition-colors hover:bg-espresso focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass md:ml-0"
      >
        Get Started
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </header>
  );
}
