"use client";

import Image from "next/image";
import { useState } from "react";

type Img = { url: string; alt: string };

const isSvg = (u: string) => u.endsWith(".svg");

export function ProductGallery({ images, title }: { images: Img[]; title: string }) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const count = images.length;
  const current = images[index] ?? images[0];
  const go = (i: number) => setIndex(((i % count) + count) % count);

  function onKeyDown(e: React.KeyboardEvent) {
    if (count < 2) return;
    if (e.key === "ArrowRight") go(index + 1);
    if (e.key === "ArrowLeft") go(index - 1);
  }

  const dialogRef = (el: HTMLDialogElement | null) => {
    if (!el || el.open) return;
    if (typeof el.showModal === "function") el.showModal();
    else el.setAttribute("open", "");
  };

  return (
    <div onKeyDown={onKeyDown}>
      <div className="bg-surface relative aspect-[4/5] overflow-hidden rounded-sm">
        <Image
          src={current.url}
          alt={current.alt || title}
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          unoptimized={isSvg(current.url)}
          className="object-cover"
        />
        <button
          type="button"
          onClick={() => setZoom(true)}
          aria-label="Open image in larger view"
          className="bg-background/90 hover:bg-background absolute right-3 bottom-3 rounded-full px-3 py-2 text-xs font-medium shadow"
        >
          Enlarge
        </button>
        {count > 1 && (
          <>
            <p className="bg-background/90 absolute top-3 left-3 rounded px-2 py-1 text-xs">
              <span className="sr-only">Image </span>
              {index + 1} / {count}
            </p>
            <button
              type="button"
              aria-label="Previous image"
              onClick={() => go(index - 1)}
              className="bg-background/90 hover:bg-background absolute top-1/2 left-3 h-10 w-10 -translate-y-1/2 rounded-full shadow"
            >
              <span aria-hidden="true">&#8249;</span>
            </button>
            <button
              type="button"
              aria-label="Next image"
              onClick={() => go(index + 1)}
              className="bg-background/90 hover:bg-background absolute top-1/2 right-3 h-10 w-10 -translate-y-1/2 rounded-full shadow"
            >
              <span aria-hidden="true">&#8250;</span>
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <ul aria-label="Product images" className="mt-3 flex gap-2 overflow-x-auto">
          {images.map((img, i) => (
            <li key={img.url + i} className="shrink-0">
              <button
                type="button"
                aria-label={`Show image ${i + 1}`}
                aria-current={i === index ? "true" : undefined}
                onClick={() => setIndex(i)}
                className={`relative block h-20 w-16 overflow-hidden rounded-sm border-2 ${
                  i === index ? "border-accent" : "border-transparent"
                }`}
              >
                <Image
                  src={img.url}
                  alt=""
                  fill
                  sizes="64px"
                  unoptimized={isSvg(img.url)}
                  className="object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      {zoom && (
        <dialog
          ref={dialogRef}
          aria-label={`${title}, larger view`}
          onClose={() => setZoom(false)}
          onClick={(e) => e.target === e.currentTarget && setZoom(false)}
          className="bg-background m-auto max-h-[92vh] w-[min(92vw,720px)] rounded-sm p-3 backdrop:bg-black/70"
        >
          <button
            type="button"
            autoFocus
            onClick={() => setZoom(false)}
            className="border-border mb-2 ml-auto block rounded-sm border px-3 py-1 text-sm"
          >
            Close
          </button>
          <div className="relative mx-auto aspect-[4/5] max-h-[78vh]">
            <Image
              src={current.url}
              alt={current.alt || title}
              fill
              sizes="720px"
              unoptimized={isSvg(current.url)}
              className="object-contain"
            />
          </div>
        </dialog>
      )}
    </div>
  );
}
