import { AlertCircle } from "lucide-react";
import Image from "next/image";

export function EmptyState({ title = "Nothing here yet", description = "Try changing your filters or check back soon." }: { title?: string; description?: string }) {
  return <div className="grid min-h-64 place-items-center rounded-3xl border border-dashed border-gray-300 bg-white p-7 text-center"><div><Image src="/brand/mascot-2d-happy.png" alt="" width={118} height={98} className="mx-auto h-24 w-auto object-contain" /><h3 className="mt-2 text-lg font-bold">{title}</h3><p className="mx-auto mt-1 max-w-md text-sm leading-6 text-[var(--takeme-gray)]">{description}</p></div></div>;
}

export function ErrorState({ message = "Something went wrong. Please try again." }: { message?: string }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertCircle size={19} className="shrink-0" /><p>{message}</p></div>;
}

export function ListingSkeleton() {
  return <div className="animate-pulse overflow-hidden rounded-2xl border border-stone-200 bg-white"><div className="aspect-[4/3] bg-stone-200" /><div className="space-y-3 p-4"><div className="h-4 w-4/5 rounded bg-stone-200" /><div className="h-5 w-2/5 rounded bg-stone-200" /><div className="h-3 w-3/5 rounded bg-stone-100" /></div></div>;
}
