"use client";

import { useRef } from "react";

/** Horizontal scroll-snap carousel with previous/next buttons. */
export function Carousel({
  label,
  children,
  arrowTop = "top-1/3",
}: {
  label: string;
  children: React.ReactNode;
  /** Tailwind class placing the arrows vertically (e.g. level with the middle of round images). */
  arrowTop?: string;
}) {
  const track = useRef<HTMLUListElement>(null);

  function scrollByPage(dir: 1 | -1) {
    const el = track.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" });
  }

  const arrow =
    "absolute z-10 hidden h-10 w-10 items-center justify-center rounded-full border border-border bg-background shadow md:flex hover:bg-surface";

  return (
    <div className="relative" role="region" aria-roledescription="carousel" aria-label={label}>
      <button
        type="button"
        aria-label={`Previous ${label}`}
        className={`${arrow} ${arrowTop} -left-3`}
        onClick={() => scrollByPage(-1)}
      >
        <span aria-hidden="true">&#8249;</span>
      </button>
      <ul
        ref={track}
        className="flex snap-x snap-mandatory [scrollbar-width:none] gap-4 overflow-x-auto scroll-smooth pb-2 [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </ul>
      <button
        type="button"
        aria-label={`Next ${label}`}
        className={`${arrow} ${arrowTop} -right-3`}
        onClick={() => scrollByPage(1)}
      >
        <span aria-hidden="true">&#8250;</span>
      </button>
    </div>
  );
}

export function CarouselItem({
  children,
  widthClass = "w-[46%] sm:w-[31%] lg:w-[22%]",
}: {
  children: React.ReactNode;
  /** Width of one item; the default shows about 2, 3 or 4.5 product cards. */
  widthClass?: string;
}) {
  return <li className={`shrink-0 snap-start ${widthClass}`}>{children}</li>;
}
