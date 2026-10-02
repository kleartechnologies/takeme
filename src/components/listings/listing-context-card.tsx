import Image from "next/image";

/** Public listing context shared by deal sheets and participant conversations. */
export function ListingContextCard({ title, image, detail, price }: { title: string; image?: string; detail?: string; price?: string }) {
  return <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-[var(--takeme-shadow-sm)]">
    {image && <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-stone-100"><Image src={image} alt="" fill sizes="80px" className="object-cover" /></div>}
    <div className="min-w-0"><p className="line-clamp-2 text-sm font-semibold leading-5">{title}</p>{detail && <p className="mt-1 text-xs text-[var(--takeme-gray)]">{detail}</p>}{price && <p className="mt-1 text-lg font-bold text-[var(--takeme-dark-green)]">{price}</p>}</div>
  </div>;
}
