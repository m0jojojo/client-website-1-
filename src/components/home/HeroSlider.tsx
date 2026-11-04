"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { heroSlides } from "@/lib/home";

const INTERVAL_MS = 6000;

export function HeroSlider() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = heroSlides.length;

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (paused || reduced) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [paused, count]);

  const go = (i: number) => setIndex(((i % count) + count) % count);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured collections"
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {heroSlides.map((s, i) => (
        <div
          key={s.id}
          role="group"
          aria-roledescription="slide"
          aria-label={`${i + 1} of ${count}`}
          hidden={i !== index}
          className={`${s.tone} flex min-h-[320px] items-center justify-center px-6 py-16 text-center sm:min-h-[420px]`}
        >
          <div className="max-w-2xl">
            <p className="mb-2 text-xs font-semibold tracking-[0.2em] uppercase opacity-80">
              {s.eyebrow}
            </p>
            <h2 className="text-3xl font-bold sm:text-5xl">{s.title}</h2>
            <p className="mt-3 text-base opacity-90 sm:text-lg">{s.body}</p>
            <Link
              href={s.cta.href}
              className="mt-6 inline-flex h-12 items-center rounded-sm bg-white px-7 font-medium text-black hover:bg-white/90"
            >
              {s.cta.label}
            </Link>
          </div>
        </div>
      ))}

      <button
        type="button"
        aria-label="Previous slide"
        onClick={() => go(index - 1)}
        className="absolute top-1/2 left-3 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-2xl text-white hover:bg-black/60"
      >
        <span aria-hidden="true">&#8249;</span>
      </button>
      <button
        type="button"
        aria-label="Next slide"
        onClick={() => go(index + 1)}
        className="absolute top-1/2 right-3 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-2xl text-white hover:bg-black/60"
      >
        <span aria-hidden="true">&#8250;</span>
      </button>

      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
        {heroSlides.map((s, i) => (
          <button
            key={s.id}
            type="button"
            aria-label={`Go to slide ${i + 1}`}
            aria-current={i === index ? "true" : undefined}
            onClick={() => go(i)}
            className={`h-2.5 rounded-full transition-all ${i === index ? "w-6 bg-white" : "w-2.5 bg-white/50"}`}
          />
        ))}
      </div>
    </section>
  );
}
