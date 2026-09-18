"use client";

import { Camera, Gavel, ImagePlus, LoaderCircle, ShoppingBag, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/components/auth/auth-provider";
import { FirebaseSetupState, SignInRequired } from "@/components/ui/firebase-state";
import { categories } from "@/data/categories";
import { MAX_IMAGE_BYTES, MAX_LISTING_IMAGES, validateImageFiles } from "@/lib/listing-validation";
import { createListing, updateListing } from "@/lib/services/listings";
import type { Listing, ListingCondition, ListingInput } from "@/types/marketplace";

interface SellValues {
  title: string;
  categoryId: string;
  condition: ListingCondition;
  description: string;
  price: string;
  location: string;
  listingType: "buy_now";
}

interface PhotoEntry { id: string; url: string; file?: File; existing: boolean }

export function SellForm({ listing }: { listing?: Listing }) {
  const router = useRouter();
  const { user, loading, configured } = useAuth();
  const [photos, setPhotos] = useState<PhotoEntry[]>(() => listing?.imageUrls.map((url) => ({ id: url, url, existing: true })) ?? []);
  const [photoError, setPhotoError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const defaults = useMemo<SellValues>(() => ({ title: listing?.title ?? "", categoryId: listing?.categoryId ?? "", condition: listing?.condition ?? "Good", description: listing?.description ?? "", price: listing ? String(listing.price) : "", location: listing?.location ?? "", listingType: "buy_now" }), [listing]);
  const { register, handleSubmit, formState: { errors } } = useForm<SellValues>({ defaultValues: defaults });

  if (!configured) return <FirebaseSetupState />;
  if (loading) return <div className="min-h-96 animate-pulse rounded-3xl bg-stone-100" />;
  if (!user) return <SignInRequired message="Log in before creating or editing a listing." />;

  function addPhotos(files: FileList | null) {
    if (!files) return;
    const incoming = Array.from(files);
    const errors = validateImageFiles(incoming);
    const meaningfulErrors = errors.filter((error) => error !== "Add at least one image.");
    if (meaningfulErrors.length) { setPhotoError(meaningfulErrors[0]); return; }
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
    const input: ListingInput = { title: values.title, description: values.description, categoryId: values.categoryId, condition: values.condition, price: Number(values.price), listingType: "buy_now", location: values.location };
    setBusy(true); setSubmitError(""); setProgress(listing ? "Saving changes…" : "Preparing your listing…");
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
      setSubmitError(error instanceof Error ? error.message : "The listing could not be saved.");
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
        <Section number="03" title="Set the deal" description="Fixed-price listings are available now. Auctions arrive in Phase 3.">
          <fieldset><legend className="sr-only">Listing type</legend><input type="hidden" {...register("listingType")} /><div className="grid gap-3 sm:grid-cols-2"><TypeOption title="Buy now" description="Set one price" icon={<ShoppingBag size={20} />} active /><TypeOption title="Auction" description="Available in Phase 3" icon={<Gavel size={20} />} disabled /></div></fieldset>
          <div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Price (RM)" error={errors.price?.message}><input type="number" min="1" max="10000000" step="0.01" {...register("price", { required: "Add a price.", validate: (value) => Number(value) > 0 || "Price must be greater than RM0." })} placeholder="0.00" /></Field><Field label="Location" error={errors.location?.message}><input {...register("location", { required: "Add a location.", minLength: { value: 2, message: "Add a more specific location." }, maxLength: { value: 120, message: "Keep the location under 120 characters." } })} placeholder="e.g. Shah Alam, Selangor" /></Field></div>
        </Section>
      </div>
      <aside className="h-fit rounded-3xl border border-gray-200 bg-white p-5 shadow-[var(--takeme-shadow-sm)] lg:sticky lg:top-24"><div className="grid size-11 place-items-center rounded-2xl bg-[var(--takeme-light-green)] text-[var(--takeme-dark-green)]"><Camera size={21} /></div><h2 className="mt-4 text-lg font-bold">Ready to publish?</h2><ul className="mt-4 grid gap-3 text-sm leading-5 text-[var(--takeme-gray)]"><li>• Images are clear and belong to you</li><li>• Condition and defects are described honestly</li><li>• Price and meetup location are accurate</li></ul><div className="mt-5 rounded-xl bg-gray-100 p-3 text-xs leading-5 text-[var(--takeme-gray)]">Your account ID is applied securely. Seller ownership cannot be changed in this form.</div>{submitError && <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-semibold leading-5 text-red-700" role="alert">{submitError}</p>}{progress && <p className="mt-4 text-center text-xs font-semibold text-[var(--takeme-dark-green)]" role="status">{progress}</p>}<button disabled={busy} className="button-primary mt-5 h-12 w-full" type="submit">{busy && <LoaderCircle size={17} className="animate-spin" />}{listing ? "Save changes" : "Publish listing"}</button></aside>
    </form>
  );
}

function Section({ number, title, description, children }: { number: string; title: string; description: string; children: React.ReactNode }) { return <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-[var(--takeme-shadow-sm)] sm:p-7"><div className="mb-6 flex gap-4"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--takeme-dark-green)] text-xs font-semibold text-white">{number}</span><div><h2 className="text-xl font-bold tracking-tight">{title}</h2><p className="mt-1 text-sm text-[var(--takeme-gray)]">{description}</p></div></div>{children}</section>; }
function Field({ label, error, wide, children }: { label: string; error?: string; wide?: boolean; children: React.ReactNode }) { return <label className={`form-field ${wide ? "sm:col-span-2" : ""}`}><span>{label}</span>{children}{error && <span className="field-error">{error}</span>}</label>; }
function TypeOption({ title, description, icon, active, disabled }: { title: string; description: string; icon: React.ReactNode; active?: boolean; disabled?: boolean }) { return <div aria-disabled={disabled} className={`flex items-center gap-3 rounded-2xl border p-4 ${active ? "border-[var(--takeme-green)] bg-[var(--takeme-light-green)]" : "border-gray-200 bg-gray-50 opacity-60"}`}><span className={active ? "text-[var(--takeme-dark-green)]" : "text-[var(--takeme-gray)]"}>{icon}</span><span><span className="block text-sm font-semibold">{title}</span><span className="block text-xs text-[var(--takeme-gray)]">{description}</span></span></div>; }

export const listingImageLimits = { maxImages: MAX_LISTING_IMAGES, maxBytes: MAX_IMAGE_BYTES };
