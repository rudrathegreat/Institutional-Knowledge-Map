"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteHeader() {
  const pathname = usePathname();
  const peopleIsActive =
    pathname === "/people" || pathname.startsWith("/people/");
  const networkIsActive =
    pathname === "/network" || pathname.startsWith("/network/");

  return (
    <header className="siteHeader">
      <div className="siteHeaderInner">
        <Link className="siteBrand" href="/" aria-label="Expertise Navigator home">
          Expertise Navigator
        </Link>

        <nav className="siteNav" aria-label="Primary navigation">
          <Link
            href="/"
            className="siteNavLink"
            aria-current={pathname === "/" ? "page" : undefined}
          >
            Search
          </Link>
          <Link
            href="/people"
            className="siteNavLink"
            aria-current={peopleIsActive ? "page" : undefined}
          >
            People
          </Link>
          <Link
            href="/network"
            className="siteNavLink"
            aria-current={networkIsActive ? "page" : undefined}
          >
            Network
          </Link>
        </nav>
      </div>
    </header>
  );
}
