"use client";

import { useRef } from "react";

/** Horizontal scroll-snap carousel with previous/next buttons. */
export function Carousel({ label, children }: { label: string; children: React.ReactNode }) {
  const track = useRef<HTMLUListElement>(null);

  function scrollByPage(dir: 1 | -1) {
    const el = track.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" });
  }

  const arrow =
    "absolute top-1/3 z-10 hidden h-10 w-10 items-center justify-center rounded-full border border-border bg-background shadow md:flex hover:bg-surface";

  return (
    <div className="relative" role="region" aria-roledescription="carousel" aria-label={label}>
      <button
        type="button"
        aria-label={`Previous ${label}`}
        className={`${arrow} -left-3`}
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
        className={`${arrow} -right-3`}
        onClick={() => scrollByPage(1)}
      >
        <span aria-hidden="true">&#8250;</span>
      </button>
    </div>
  );
}

export function CarouselItem({ children }: { children: React.ReactNode }) {
  return <li className="w-[46%] shrink-0 snap-start sm:w-[31%] lg:w-[22%]">{children}</li>;
}
