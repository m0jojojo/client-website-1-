"use client";

import { useState } from "react";
import { siteConfig } from "@/lib/site";

/**
 * A scrolling announcement bar.
 *  - Scrolls continuously and pauses while hovered or focused, or when the Pause button is pressed
 *    (moving content needs a way to stop it for keyboard and touch users).
 *  - Visitors who prefer reduced motion get a still, centred line instead (see globals.css).
 *  - The messages are repeated so the loop has no gap; only the first set is read by screen readers.
 */
export function PromoStrip() {
  const [paused, setPaused] = useState(false);
  const messages = siteConfig.promo;
  // Two identical halves: the animation slides left by exactly one half, then restarts seamlessly.
  // Each half repeats the messages so it is always wider than even a very wide screen.
  const halves = [0, 1];
  const sets = [0, 1];

  return (
    <div
      role="region"
      aria-label="Store announcements"
      className="promo-marquee bg-accent text-accent-foreground relative overflow-hidden text-xs font-semibold tracking-wide uppercase"
      data-paused={paused}
    >
      <div className="promo-track flex w-max py-2">
        {halves.map((half) => (
          <ul
            key={half}
            className="promo-half flex shrink-0 items-center"
            aria-hidden={half === 1 || undefined}
          >
            {sets.map((set) =>
              messages.map((m) => (
                <li
                  key={`${set}-${m}`}
                  aria-hidden={set === 1 || undefined}
                  className={`flex items-center whitespace-nowrap ${half === 1 || set === 1 ? "promo-repeat" : ""}`}
                >
                  <span className="px-6">{m}</span>
                  <span aria-hidden="true" className="opacity-60">
                    &bull;
                  </span>
                </li>
              )),
            )}
          </ul>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-pressed={paused}
        aria-label={paused ? "Play announcements" : "Pause announcements"}
        className="promo-control bg-accent absolute inset-y-0 right-0 flex w-9 items-center justify-center shadow-[-8px_0_8px_-2px_var(--accent)] hover:opacity-80"
      >
        <span aria-hidden="true">{paused ? "▶" : "❚❚"}</span>
      </button>
    </div>
  );
}
