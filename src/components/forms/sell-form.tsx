"use client";

import { Camera, Gavel, ImagePlus, LoaderCircle, ShoppingBag, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm, useWatch, type UseFormRegister } from "react-hook-form";
import { useAuth } from "@/components/auth/auth-provider";
import { FirebaseSetupState, SignInRequired } from "@/components/ui/firebase-state";
import { categories } from "@/data/categories";
import { MAX_IMAGE_BYTES, MAX_LISTING_IMAGES, ringgitToSen, senToRinggit, validateImageFiles } from "@/lib/listing-validation";
import { createListing, updateListing } from "@/lib/services/listings";
import type { Listing, ListingCondition, ListingInput, ListingType } from "@/types/marketplace";

interface SellValues {
  title: string;
  categoryId: string;
  condition: ListingCondition;
  description: string;
  price: string;
  location: string;
  listingType: Extract<ListingType, "buy_now" | "auction">;
  startingBid: string;
  minimumBidIncrement: string;
  auctionStartAt: string;
  auctionEndAt: string;
}

interface PhotoEntry { id: string; url: string; file?: File; existing: boolean }

function localDateTime(value: Date | string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function auctionDefaults() {
  const start = new Date(Date.now() + 10 * 60_000);
  start.setSeconds(0, 0);
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60_000);
  return { start: localDateTime(start), end: localDateTime(end) };
}

export function SellForm({ listing }: { listing?: Listing }) {
  const router = useRouter();
  const { user, loading, configured } = useAuth();
  const defaults = useMemo<SellValues>(() => {
    const dates = auctionDefaults();
    return {
      title: listing?.title ?? "",
      categoryId: listing?.categoryId ?? "",
      condition: listing?.condition ?? "Good",
      description: listing?.description ?? "",
      price: listing?.listingType === "buy_now" ? String(listing.price) : "",
      location: listing?.location ?? "",
      listingType: listing?.listingType === "auction" ? "auction" : "buy_now",
      startingBid: listing?.startingBid ? senToRinggit(listing.startingBid) : "",
      minimumBidIncrement: listing?.minimumBidIncrement ? senToRinggit(listing.minimumBidIncrement) : "",
      auctionStartAt: listing?.auctionStartAt ? localDateTime(listing.auctionStartAt) : dates.start,
      auctionEndAt: listing?.auctionEndAt ? localDateTime(listing.auctionEndAt) : dates.end,
    };
  }, [listing]);
  const [photos, setPhotos] = useState<PhotoEntry[]>(() => listing?.imageUrls.map((url) => ({ id: url, url, existing: true })) ?? []);
  const [photoError, setPhotoError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const { register, handleSubmit, control, setValue, formState: { errors } } = useForm<SellValues>({ defaultValues: defaults });
  const listingType = useWatch({ control, name: "listingType" });
  const preview = useWatch({ control });

  if (!configured) return <FirebaseSetupState />;
  if (loading) return <div className="min-h-96 animate-pulse rounded-3xl bg-stone-100" />;
  if (!user) return <SignInRequired message="Log in before creating or editing a listing." />;

  function addPhotos(files: FileList | null) {
    if (!files) return;
    const incoming = Array.from(files);
    const meaningfulErrors = validateImageFiles(incoming).filter((error) => error !== "Add at least one image.");
    if (meaningfulErrors.length) { setPhotoError(meaningfulErrors[0] ?? "The image is invalid."); return; }
    if (photos.length + incoming.length > MAX_LISTING_IMAGES) { setPhotoError(`You can upload up to ${MAX_LISTING_IMAGES} images.`); return; }
    setPhotos((current) => [...current, ...incoming.map((file) => ({ id: crypto.randomUUID(), url: URL.createObjectURL(file), file, existing: false }))]);
    setPhotoError("");
  }

  function removePhoto(photo: PhotoEntry) {
    if (!photo.existing) URL.revokeObjectURL(photo.url);
    setPhotos((current) => current.filter((item) => item.id !== photo.id));
  }

  async function submit(values: SellValues) {
    if (photos.length === 0) { setPhotoError("Add at least one image."); return; }
    let input: ListingInput;
    if (values.listingType === "auction") {
      const startingBid = ringgitToSen(values.startingBid);
      const minimumBidIncrement = ringgitToSen(values.minimumBidIncrement);
      if (!startingBid || !minimumBidIncrement) { setSubmitError("Enter valid auction amounts with no more than 2 decimal places."); return; }
      const start = new Date(values.auctionStartAt);
      const end = new Date(values.auctionEndAt);
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) { setSubmitError("Choose valid auction start and end times."); return; }
      if (end.getTime() <= start.getTime()) { setSubmitError("Auction end time must be after its start time."); return; }
      input = {
        title: values.title,
        description: values.description,
        categoryId: values.categoryId,
        condition: values.condition,
        listingType: "auction",
        location: values.location,
        startingBid,
        minimumBidIncrement,
        auctionStartAt: start.toISOString(),
        auctionEndAt: end.toISOString(),
      };
    } else {
      input = { title: values.title, description: values.description, categoryId: values.categoryId, condition: values.condition, price: Number(values.price), listingType: "buy_now", location: values.location };
    }
    setBusy(true); setSubmitError(""); setProgress(listing ? "Saving changes…" : listingType === "auction" ? "Creating your secure auction…" : "Preparing your listing…");
    try {
      if (listing) {
        await updateListing(listing.id, input, photos.filter((photo) => photo.existing).map((photo) => photo.url), photos.flatMap((photo) => photo.file ? [photo.file] : []));
        router.push(`/listings/${listing.id}?updated=1`);
      } else {
        setProgress("Optimising and uploading images…");
        const id = await createListing(input, photos.flatMap((photo) => photo.file ? [photo.file] : []));
        router.push(`/listings/${id}?created=1`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setSubmitError(/firebase|firestore|storage|permission-denied/i.test(message) ? "We couldn’t save this listing. Check your connection and try again." : message || "The listing could not be saved. Please try again.");
      setBusy(false); setProgress("");
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="grid gap-6">
        <Section number="01" title="Show what you’re selling" description={`JPEG, PNG or WebP · up to ${MAX_LISTING_IMAGES} images · 8 MB each.`}>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {photos.map((photo, index) => <div key={photo.id} className="relative aspect-square overflow-hidden rounded-2xl border border-stone-200"><Image src={photo.url} alt={`Listing image ${index + 1}`} fill sizes="160px" className="object-cover" unoptimized={!photo.existing} /><button type="button" onClick={() => removePhoto(photo)} className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-white text-stone-700 shadow" aria-label="Remove image"><X size={15} /></button></div>)}
            {photos.length < MAX_LISTING_IMAGES && <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 text-center text-xs font-semibold text-[var(--takeme-gray)] hover:border-[var(--takeme-green)] hover:bg-[var(--takeme-light-green)]"><ImagePlus size={24} className="text-[var(--takeme-dark-green)]" />Add images<input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { addPhotos(event.target.files); event.target.value = ""; }} /></label>}
          </div>{photoError && <p className="field-error mt-2" role="alert">{photoError}</p>}
        </Section>
        <Section number="02" title="Describe your item" description="Specific details help buyers decide faster.">
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Title" error={errors.title?.message} wide><input {...register("title", { required: "Add a title.", minLength: { value: 6, message: "Use at least 6 characters." }, maxLength: { value: 80, message: "Keep the title under 80 characters." } })} placeholder="e.g. Fujifilm camera in great condition" /></Field><Field label="Category" error={errors.categoryId?.message}><select {...register("categoryId", { required: "Choose a category." })}><option value="">Select category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field><Field label="Condition" error={errors.condition?.message}><select {...register("condition", { required: "Choose a condition." })}><option>New</option><option>Like new</option><option>Good</option><option>Fair</option></select></Field><Field label="Description" error={errors.description?.message} wide><textarea {...register("description", { required: "Add a description.", minLength: { value: 20, message: "Share at least 20 characters." }, maxLength: { value: 1200, message: "Keep it under 1,200 characters." } })} placeholder="Include age, what’s included, and any signs of use." /></Field></div>
        </Section>
        <Section number="03" title="Set the deal" description="Choose a fixed price or let buyers compete in an auction.">
          <input type="hidden" {...register("listingType")} />
          <div className="grid gap-3 sm:grid-cols-2">
            <TypeOption title="Buy now" description="Set one fixed price" icon={<ShoppingBag size={20} />} active={listingType === "buy_now"} disabled={Boolean(listing && listing.listingType !== "buy_now")} onClick={() => setValue("listingType", "buy_now", { shouldValidate: true })} />
            <TypeOption title="Auction" description="Accept secure competing bids" icon={<Gavel size={20} />} active={listingType === "auction"} disabled={Boolean(listing && listing.listingType !== "auction")} onClick={() => setValue("listingType", "auction", { shouldValidate: true })} />
          </div>
          {listingType === "buy_now" ? <div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Price (RM)" error={errors.price?.message}><input type="number" min="0.01" max="10000000" step="0.01" {...register("price", { required: "Add a price.", validate: (value) => Number(value) > 0 || "Price must be greater than RM0." })} placeholder="0.00" /></Field><LocationField register={register} error={errors.location?.message} /></div> : <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Starting bid (RM)" error={errors.startingBid?.message}><input type="number" min="0.01" step="0.01" {...register("startingBid", { required: "Add a starting bid.", validate: (value) => Boolean(ringgitToSen(value)) || "Use a positive amount with up to 2 decimals." })} placeholder="100.00" /></Field>
            <Field label="Minimum increment (RM)" error={errors.minimumBidIncrement?.message}><input type="number" min="0.01" step="0.01" {...register("minimumBidIncrement", { required: "Add a minimum increment.", validate: (value) => Boolean(ringgitToSen(value)) || "Use a positive amount with up to 2 decimals." })} placeholder="10.00" /></Field>
            <Field label="Auction starts" error={errors.auctionStartAt?.message}><input type="datetime-local" {...register("auctionStartAt", { required: "Choose a start time." })} /></Field>
            <Field label="Auction ends" error={errors.auctionEndAt?.message}><input type="datetime-local" {...register("auctionEndAt", { required: "Choose an end time." })} /></Field>
            <div className="sm:col-span-2"><LocationField register={register} error={errors.location?.message} /></div>
            <p className="sm:col-span-2 rounded-xl bg-[var(--takeme-light-green)] p-3 text-xs leading-5 text-[var(--takeme-dark-green)]">The starting bid is the first bid buyers can place. Each later bid must rise by at least your minimum increment. Auctions are scheduled by default; once bidding starts, timing and bid settings are locked. Payment is not active yet.</p>
          </div>}
        </Section>
      </div>
      <aside className="h-fit rounded-3xl border border-gray-200 bg-white p-5 shadow-[var(--takeme-shadow-sm)] lg:sticky lg:top-24"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--takeme-dark-green)]">Listing preview</p><div className="mt-3 overflow-hidden rounded-2xl border border-gray-200"><div className="relative aspect-[4/3] bg-stone-100">{photos[0] ? <Image src={photos[0].url} alt="Preview of your first listing photo" fill sizes="320px" className="object-cover" unoptimized={!photos[0].existing} /> : <div className="grid h-full place-items-center text-stone-400"><Camera size={32} /></div>}</div><div className="p-3"><p className="line-clamp-2 text-sm font-semibold">{preview.title?.trim() || "Your listing title"}</p><p className="mt-1 font-bold">{listingType === "auction" ? `Starting bid RM ${preview.startingBid || "0.00"}` : `RM ${preview.price || "0.00"}`}</p><p className="mt-1 truncate text-xs text-stone-500">{preview.location || "Your location"}</p></div></div><h2 className="mt-5 text-lg font-bold">Ready to publish?</h2><ul className="mt-3 grid gap-2 text-sm leading-5 text-[var(--takeme-gray)]"><li>• Images are clear and belong to you</li><li>• Condition and defects are described honestly</li><li>• {listingType === "auction" ? "Auction timing and bid settings are accurate" : "Price and location are accurate"}</li></ul><div className="mt-5 rounded-xl bg-gray-100 p-3 text-xs leading-5 text-[var(--takeme-gray)]">Publishing makes this item visible to buyers. {listingType === "auction" ? "Scheduled auctions accept bids only after they start." : "Checkout is not available yet."}</div>{submitError && <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-semibold leading-5 text-red-700" role="alert">{submitError}</p>}{progress && <p className="mt-4 text-center text-xs font-semibold text-[var(--takeme-dark-green)]" role="status">{progress}</p>}<button disabled={busy} className="button-primary mt-5 h-12 w-full" type="submit">{busy && <LoaderCircle size={17} className="animate-spin" />}{listing ? "Save changes" : listingType === "auction" ? "Publish auction" : "Publish listing"}</button></aside>
    </form>
  );
}

function Section({ number, title, description, children }: { number: string; title: string; description: string; children: React.ReactNode }) { return <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-[var(--takeme-shadow-sm)] sm:p-7"><div className="mb-6 flex gap-4"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--takeme-dark-green)] text-xs font-semibold text-white">{number}</span><div><h2 className="text-xl font-bold tracking-tight">{title}</h2><p className="mt-1 text-sm text-[var(--takeme-gray)]">{description}</p></div></div>{children}</section>; }
function Field({ label, error, wide, children }: { label: string; error?: string; wide?: boolean; children: React.ReactNode }) { return <label className={`form-field ${wide ? "sm:col-span-2" : ""}`}><span>{label}</span>{children}{error && <span className="field-error">{error}</span>}</label>; }
function LocationField({ register, error }: { register: UseFormRegister<SellValues>; error?: string }) { return <Field label="Location" error={error}><input {...register("location", { required: "Add a location.", minLength: { value: 2, message: "Add a more specific location." }, maxLength: { value: 120, message: "Keep the location under 120 characters." } })} placeholder="e.g. Shah Alam, Selangor" /></Field>; }
function TypeOption({ title, description, icon, active, disabled, onClick }: { title: string; description: string; icon: React.ReactNode; active: boolean; disabled?: boolean; onClick: () => void }) { return <button type="button" disabled={disabled} onClick={onClick} className={`flex items-center gap-3 rounded-2xl border p-4 text-left ${active ? "border-[var(--takeme-green)] bg-[var(--takeme-light-green)]" : "border-gray-200 bg-gray-50"} disabled:cursor-not-allowed disabled:opacity-50`}><span className={active ? "text-[var(--takeme-dark-green)]" : "text-[var(--takeme-gray)]"}>{icon}</span><span><span className="block text-sm font-semibold">{title}</span><span className="block text-xs text-[var(--takeme-gray)]">{description}</span></span></button>; }

export const listingImageLimits = { maxImages: MAX_LISTING_IMAGES, maxBytes: MAX_IMAGE_BYTES };
