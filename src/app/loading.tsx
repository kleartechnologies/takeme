import { ListingSkeleton } from "@/components/ui/states";
export default function Loading() { return <main className="page-shell py-10"><div className="mb-7 h-10 w-64 animate-pulse rounded-xl bg-stone-200" /><div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <ListingSkeleton key={index} />)}</div></main>; }
