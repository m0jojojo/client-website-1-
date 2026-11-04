import Image from "next/image";
import Link from "next/link";
import { categoryTiles } from "@/lib/home";

export function CategoryTiles() {
  return (
    <section aria-labelledby="shop-by-category" className="mx-auto max-w-7xl px-4 py-10">
      <h2
        id="shop-by-category"
        className="mb-6 text-center text-xl font-semibold tracking-wide uppercase"
      >
        Shop By Category
      </h2>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {categoryTiles.map((c) => (
          <li key={c.handle}>
            <Link href={`/collections/${c.handle}`} className="group block text-center">
              <div className="bg-surface relative aspect-square overflow-hidden rounded-sm">
                <Image
                  src="/images/placeholder.svg"
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
                  unoptimized
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <span className="mt-2 block text-sm font-medium">{c.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
