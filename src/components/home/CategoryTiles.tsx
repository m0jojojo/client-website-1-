import Image from "next/image";
import Link from "next/link";
import { Carousel, CarouselItem } from "@/components/ui/Carousel";
import { categoryTiles } from "@/lib/home";

const PLACEHOLDER = "/images/placeholder.svg";

/** Round category pictures in a swipeable carousel (arrow buttons on larger screens). */
export function CategoryTiles() {
  return (
    <section aria-labelledby="shop-by-category" className="mx-auto max-w-7xl px-4 py-10">
      <h2
        id="shop-by-category"
        className="mb-8 text-center text-xl font-semibold tracking-wide uppercase"
      >
        Shop By Category
      </h2>
      <Carousel label="Categories" arrowTop="top-[38%]">
        {categoryTiles.map((c) => (
          <CarouselItem key={c.handle} widthClass="w-[40%] sm:w-[26%] md:w-[20%] lg:w-[14.5%]">
            <Link href={`/collections/${c.handle}`} className="group block text-center">
              <span className="bg-surface border-border relative mx-auto block aspect-square w-full overflow-hidden rounded-full border shadow-sm">
                <Image
                  src={c.image ?? PLACEHOLDER}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 15vw, (min-width: 640px) 26vw, 40vw"
                  unoptimized={(c.image ?? PLACEHOLDER).endsWith(".svg")}
                  className="object-cover transition-transform duration-300 group-hover:scale-110"
                />
              </span>
              <span className="mt-3 block px-1 text-xs leading-snug font-semibold tracking-wide uppercase sm:text-sm">
                {c.title}
              </span>
            </Link>
          </CarouselItem>
        ))}
      </Carousel>
    </section>
  );
}
