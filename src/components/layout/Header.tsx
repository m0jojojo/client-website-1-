"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { mainNav, siteConfig, type NavItem } from "@/lib/site";

function DesktopItem({ item }: { item: NavItem }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  if (!item.children) {
    return (
      <li>
        <Link href={item.href} className="py-2 text-sm font-medium hover:underline">
          {item.label}
        </Link>
      </li>
    );
  }

  return (
    <li
      ref={ref}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 py-2 text-sm font-medium hover:underline"
      >
        {item.label}
        <span aria-hidden="true">&#9662;</span>
      </button>
      {open && (
        <ul
          aria-label={`${item.label} categories`}
          className="border-border bg-background absolute top-full left-0 z-40 min-w-64 border py-2 shadow-lg"
        >
          {item.children.map((c) => (
            <li key={c.href}>
              <Link
                href={c.href}
                onClick={() => setOpen(false)}
                className="hover:bg-surface block px-4 py-2 text-sm"
              >
                {c.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function IconLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} aria-label={label} className="hover:bg-surface rounded-sm p-2">
      {children}
    </Link>
  );
}

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="border-border bg-background sticky top-0 z-40 border-b">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
        <button
          type="button"
          className="hover:bg-surface rounded-sm p-2 lg:hidden"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          aria-controls="mobile-menu"
          onClick={() => setMobileOpen((v) => !v)}
        >
          <span aria-hidden="true" className="text-xl leading-none">
            {mobileOpen ? "✕" : "☰"}
          </span>
        </button>

        <Link
          href="/"
          className="text-sm font-bold tracking-wide whitespace-nowrap uppercase sm:text-lg"
        >
          {siteConfig.name}
        </Link>

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-6">
            {mainNav.map((item) => (
              <DesktopItem key={item.label} item={item} />
            ))}
          </ul>
        </nav>

        <div className="flex items-center">
          <IconLink href="/search" label="Search">
            <span aria-hidden="true">&#128269;</span>
          </IconLink>
          <IconLink href="/account/login" label="Log in">
            <span aria-hidden="true">&#128100;</span>
          </IconLink>
          <IconLink href="/wishlist" label="Wishlist">
            <span aria-hidden="true">&#9825;</span>
          </IconLink>
          <IconLink href="/cart" label="Cart">
            <span aria-hidden="true">&#128722;</span>
          </IconLink>
        </div>
      </div>

      {mobileOpen && (
        <nav id="mobile-menu" aria-label="Mobile" className="border-border border-t lg:hidden">
          <ul className="divide-border divide-y">
            {mainNav.map((item) => (
              <li key={item.label}>
                {item.children ? (
                  <details>
                    <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
                      {item.label}
                    </summary>
                    <ul className="bg-surface">
                      {item.children.map((c) => (
                        <li key={c.href}>
                          <Link
                            href={c.href}
                            onClick={() => setMobileOpen(false)}
                            className="block px-8 py-2 text-sm"
                          >
                            {c.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : (
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="block px-4 py-3 text-sm font-medium"
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
