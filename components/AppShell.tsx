"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useOrg } from "@/lib/demo/store";
import { BrandStyle } from "./BrandStyle";
import { OrgMark } from "./OrgMark";

const NAV: Array<{ href: string; label: string; highlight?: boolean }> = [
  { href: "/", label: "Oferty" },
  { href: "/oferty/nowa", label: "Nowa oferta" },
  { href: "/wyprobuj", label: "Ze zdjęcia do 3D", highlight: true },
  { href: "/integracje", label: "Integracje" },
  { href: "/ustawienia", label: "Ustawienia" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const org = useOrg();
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" || (path.startsWith("/oferty/") && path !== "/oferty/nowa") : path.startsWith(href));
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <BrandStyle />
      <header className="sticky top-0 z-30 border-b border-stone-900/5 bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <OrgMark org={org} size={30} />
            <span className="truncate font-semibold">{org.name}</span>
          </Link>
          <nav className="ml-auto flex gap-1 overflow-x-auto text-sm">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 transition ${active(n.href) ? "bg-stone-900 text-white" : n.highlight ? "bg-brand/10 font-medium text-brand hover:bg-brand/15" : "text-stone-600 hover:bg-stone-900/5"}`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6">{children}</main>
      <footer className="border-t border-stone-900/5 py-6 text-center text-xs text-stone-500">
        Wizualizator nieruchomości · wersja demonstracyjna · wszystkie wizualizacje mają charakter poglądowy
      </footer>
    </div>
  );
}
