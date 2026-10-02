"use client";

import { ArrowLeft, ArrowRight, Camera, Check, CheckCircle2, ChevronRight, Gavel, ImagePlus, LoaderCircle, MapPin, ShieldCheck, ShoppingBag, Wrench, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useAuth } from "@/components/auth/auth-provider";
import { StandardProductDetail } from "@/components/listings/standard-product-detail";
import { ActionSheet } from "@/components/ui/action-sheet";
import { FirebaseSetupState, SignInRequired } from "@/components/ui/firebase-state";
import { categories, getCategoryName } from "@/data/categories";
import { LISTING_CONDITIONS, MAX_IMAGE_BYTES, MAX_LISTING_IMAGES, senToRinggit, validateImageFiles } from "@/lib/listing-validation";
import { formatPublicLocation, makePublicLocation, MALAYSIAN_STATES, parseLegacyGeneralLocation } from "@/lib/general-location";
import { ListingImagePipelineError } from "@/lib/listing-image-upload";
import { getUserProfile, updatePublicProfile } from "@/lib/services/users";
import { listMeetupLocations, type MeetupLocation } from "@/lib/services/locations";
import { createListing, publishExistingAuctionDraft, publishExistingFixedDraft, saveListingDraft, updateListing } from "@/lib/services/listings";
import { SELL_STEPS, sellInput, validateSellStep, type SellValues } from "@/lib/sell-flow";
import { registerUnsavedListingWarning } from "@/lib/unsaved-listing-warning";
import type { Listing } from "@/types/marketplace";
import styles from "./sell.module.css";

interface PhotoEntry { id: string; url: string; file?: File; existing: boolean; failed?: boolean }
const conditionHelp = { New: "Brand new, unused.", "Like new": "Used, with minimal signs of wear.", Good: "Used, with normal signs of use.", Fair: "Used, with visible wear. Read the description for details." };
const money = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" });
function localDateTime(value: Date | string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
function auctionDefaults() {
  const start = new Date(Date.now() + 10 * 60_000); start.setSeconds(0, 0);
  return { start: localDateTime(start), end: localDateTime(new Date(start.getTime() + 7 * 24 * 60 * 60_000)) };
}

export function SellForm({ listing }: { listing?: Listing }) {
  const auctionDraft = listing?.listingType === "auction" && listing.status === "draft";
  const draft = listing?.status === "draft";
  const router = useRouter();
  const { user, loading, configured } = useAuth();
  const defaults = useMemo<SellValues>(() => {
    const dates = auctionDefaults();
    return { title: listing?.title ?? "", categoryId: listing?.categoryId ?? "", condition: listing?.condition ?? "Good", description: listing?.description ?? "", price: listing?.listingType === "buy_now" ? String(listing.price) : "", districtOrCity: listing?.publicLocation?.districtOrCity ?? "", state: listing?.publicLocation?.state ?? "", meetupLocationId: listing?.meetupLocationId ?? "", saveLocationToProfile: false, listingType: listing?.listingType === "auction" ? "auction" : "buy_now", startingBid: listing?.startingBid ? senToRinggit(listing.startingBid) : "", minimumBidIncrement: listing?.minimumBidIncrement ? senToRinggit(listing.minimumBidIncrement) : "", auctionStartAt: listing?.auctionStartAt ? localDateTime(listing.auctionStartAt) : dates.start, auctionEndAt: listing?.auctionEndAt ? localDateTime(listing.auctionEndAt) : dates.end, startMode: "scheduled" };
  }, [listing]);
  const [photos, setPhotos] = useState<PhotoEntry[]>(() => listing?.imageUrls.map(url => ({ id: url, url, existing: true })) ?? []);
  const photoUrls = useRef(new Set<string>());
  const [photoError, setPhotoError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [progress, setProgress] = useState("");
  const [step, setStep] = useState(listing ? 3 : 0);
  const [previewAt, setPreviewAt] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const [focusStep, setFocusStep] = useState(0);
  const [categorySearch, setCategorySearch] = useState("");
  const [meetups, setMeetups] = useState<MeetupLocation[]>([]);
  const [profileName, setProfileName] = useState("");
  const [sheet, setSheet] = useState<"publish" | "exit" | "edit" | null>(null);
  const [result, setResult] = useState<{ id: string; draft: boolean; scheduled: boolean; auction: boolean } | null>(null);
  const { register, control, setValue, getValues, setError, clearErrors, reset, formState: { errors, isDirty } } = useForm<SellValues>({ defaultValues: defaults });
  const listingType = useWatch({ control, name: "listingType" });
  const preview = useWatch({ control }) as SellValues;
  const previewLocation = makePublicLocation(preview.districtOrCity ?? "", preview.state ?? "");
  const photoChanged = !result && (photos.some((photo, index) => photo.file || photo.url !== listing?.imageUrls[index]) || photos.length !== (listing?.imageUrls.length ?? 0));
  const dirty = isDirty || photoChanged;

  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all([getUserProfile(user.uid), listMeetupLocations()]).then(([profile, savedMeetups]) => {
      if (!active) return;
      setMeetups(savedMeetups); setProfileName(profile?.displayName ?? user.displayName ?? "TAKEME member");
      if (!listing) {
        const general = parseLegacyGeneralLocation(profile?.location);
        if (general) { setValue("districtOrCity", general.districtOrCity); setValue("state", general.state); }
        const preferred = savedMeetups.find(item => item.isDefault);
        if (preferred) setValue("meetupLocationId", preferred.id);
      }
    }).catch(() => { /* General location can still be entered without profile defaults. */ });
    return () => { active = false; };
  }, [user, listing, setValue]);
  useEffect(() => { return registerUnsavedListingWarning(window, isDirty, photoChanged, busy); }, [isDirty, photoChanged, busy]);
  useEffect(() => { if (focusStep) { heading.current?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: "instant" }); } }, [step, focusStep, result]);
  useEffect(() => {
    const urls = photoUrls.current;
    return () => { for (const url of urls) URL.revokeObjectURL(url); };
  }, []);

  function go(next: number) { if (next === 7) setPreviewAt(Date.now()); setStep(next); setFocusStep(n => n + 1); }
  function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    const incoming = Array.from(files);
    const fileErrors = validateImageFiles(incoming);
    if (fileErrors.length) { setPhotoError(fileErrors[0]); return; }
    if (photos.length + incoming.length > MAX_LISTING_IMAGES) { setPhotoError(`You can upload up to ${MAX_LISTING_IMAGES} photos.`); return; }
    setPhotos(current => [...current, ...incoming.map(file => {
      const url = URL.createObjectURL(file); photoUrls.current.add(url);
      return { id: crypto.randomUUID(), url, file, existing: false };
    })]); setPhotoError("");
  }
  function removePhoto(photo: PhotoEntry) {
    if (!photo.existing) { URL.revokeObjectURL(photo.url); photoUrls.current.delete(photo.url); }
    setPhotos(current => current.filter(item => item.id !== photo.id));
  }
  function movePhoto(index: number, target: number) {
    setPhotos(current => { const next = [...current]; const [photo] = next.splice(index, 1); next.splice(target, 0, photo); return next; });
  }
  function validateStep(index: number) {
    if (index === 1) { const message = !photos.length ? "Add at least one photo." : photos.some(photo => photo.failed) ? "Remove the photo that couldn’t be read and choose another image." : ""; setPhotoError(message); return !message; }
    const found = validateSellStep(getValues(), index);
    for (const [name, message] of Object.entries(found)) setError(name as keyof SellValues, { type: "validate", message });
    return Object.keys(found).length === 0;
  }
  function validateAll() {
    clearErrors(); setSubmitError("");
    for (let index = 0; index < 7; index++) if (!validateStep(index)) { go(index); return false; }
    return true;
  }
  function next() {
    clearErrors(); setSubmitError("");
    if (step === 6 ? validateAll() : validateStep(step)) go(Math.min(7, step + 1)); else setFocusStep(n => n + 1);
  }
  function requestExit() { if (dirty && !result) setSheet("exit"); else router.push("/profile/listings"); }
  async function submit(saveDraft = false) {
    if (!user || inFlight.current) return;
    if (!validateAll()) { setSheet(null); return; }
    const values = getValues();
    if (saveDraft && values.listingType === "auction" && values.startMode === "now") {
      setError("auctionStartAt", { message: "Choose Schedule for later to save a resumable auction draft." }); go(5); return;
    }
    const input = sellInput(values);
    inFlight.current = true; setBusy(true); setSubmitError(""); setProgress("Preparing and uploading your photos…");
    try {
      if (values.saveLocationToProfile) await updatePublicProfile({ displayName: profileName, location: formatPublicLocation(input.publicLocation) });
      let id: string;
      if (saveDraft) {
        if (listing) { await updateListing(listing.id, input, photos); id = listing.id; }
        else id = await saveListingDraft(input, photos.flatMap(photo => photo.file ? [photo.file] : []));
      } else if (auctionDraft && listing) {
        await publishExistingAuctionDraft(listing.id, input, photos); id = listing.id;
      } else if (draft && listing) {
        await publishExistingFixedDraft(listing.id, input, photos); id = listing.id;
      } else if (listing) {
        await updateListing(listing.id, input, photos); id = listing.id;
      } else id = await createListing(input, photos.flatMap(photo => photo.file ? [photo.file] : []));
      reset(values); setSheet(null); setResult({ id, draft: saveDraft, scheduled: input.listingType === "auction" && Date.parse(input.auctionStartAt) > Date.now(), auction: input.listingType === "auction" }); setFocusStep(n => n + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setSubmitError(error instanceof ListingImagePipelineError ? error.message : /firebase|firestore|storage|permission-denied/i.test(message) ? "We couldn’t save this listing. Check your connection and try again. Your entries are still here." : message || "The listing could not be saved. Please try again.");
    } finally { inFlight.current = false; setBusy(false); setProgress(""); }
  }

  if (!configured) return <FirebaseSetupState />;
  if (loading) return <div className="min-h-96 animate-pulse rounded-2xl bg-stone-100" />;
  if (!user) return <SignInRequired message="Log in before creating or editing a listing." next={listing ? `/listings/${listing.id}/edit` : "/sell"} />;
  const title = result ? result.draft ? "Draft saved" : listing && !draft ? "Changes saved" : result.auction ? result.scheduled ? "Your auction is scheduled!" : "Your auction is live!" : "Your listing is live!" : listing ? draft ? "Resume your draft" : "Edit listing" : "Sell an item";
  const stepTitle = step === 5 && listingType === "auction" ? "Auction setup" : SELL_STEPS[step];
  const selectedMeetup = meetups.find(item => item.id === preview.meetupLocationId);
  let previewListing: Listing | null = null;
  if (step === 7 && previewLocation) {
    const input = sellInput(preview, previewAt);
    previewListing = { ...input, id: listing?.id ?? "unpublished-preview", sellerId: user.uid, imageUrls: photos.map(photo => photo.url), location: formatPublicLocation(previewLocation), price: input.listingType === "buy_now" ? input.price : 0, status: "active", createdAt: listing?.createdAt ?? new Date(previewAt).toISOString(), updatedAt: new Date(previewAt).toISOString(), meetupLocation: selectedMeetup ? { name: selectedMeetup.name, area: selectedMeetup.area, state: selectedMeetup.state, country: "Malaysia" } : null, ...(input.listingType === "auction" ? { bidCount: 0, currentBid: 0, auctionStatus: Date.parse(input.auctionStartAt) > previewAt ? "scheduled" : "active" } : {}) };
  }
  const publishLabel = auctionDraft ? "Publish draft auction" : listing && !draft ? "Save changes" : listingType === "auction" ? "Publish auction" : "Publish listing";

  return <div className={styles.flow} data-sell-flow>
    <header className={styles.header}><button type="button" className="icon-button" disabled={busy} aria-label={step && !result ? "Previous step" : "Exit listing flow"} onClick={() => step && !result ? go(step - 1) : requestExit()}><ArrowLeft size={21} /></button><Image src="/brand/takeme-wordmark.png" alt="TAKEME" width={108} height={36} /><button type="button" className="icon-button" disabled={busy} aria-label="Close listing flow" onClick={requestExit}><X size={21} /></button></header>
    {result ? <section className={styles.success}><Image src={result.draft ? "/brand/mascot-2d-happy.png" : "/brand/mascot-3d-excited.png"} alt="" width={190} height={190} priority /><p className={styles.eyebrow}>{result.draft ? "Safe in your drafts" : listing && !draft ? "Listing updated" : "A new find on TAKEME"}</p><h1 ref={heading} tabIndex={-1}>{title}</h1><p>{result.draft ? "Your listing is private. Resume it from My Listings when you’re ready." : result.scheduled ? `Buyers can discover your auction. Bidding opens ${new Date(preview.auctionStartAt).toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" })}.` : listing && !draft ? "Your updated details are now visible to buyers." : "Buyers can now discover your item and contact you on TAKEME."}</p><div className={styles.successActions}><Link className="button-primary" href={result.draft ? `/listings/${result.id}/edit` : `/listings/${result.id}`}>{result.draft ? "Resume draft" : result.auction ? "View auction" : "View listing"}<ArrowRight size={17} /></Link><Link className="button-secondary" href={`/profile/listings${result.draft ? "?tab=drafts" : ""}`}>My listings</Link><button type="button" className={styles.textButton} onClick={() => { if (listing) router.push("/sell"); else { reset({ ...defaults, ...auctionDefaultsToValues() }); setPhotos([]); setPhotoError(""); setResult(null); go(0); } }}>List another item</button></div></section> : <>
      <div className={styles.progressHeader}><div><h1>{title}</h1><p>Step {step + 1} of {SELL_STEPS.length} <span>· {stepTitle}</span></p></div>{(!listing || draft) && <button type="button" disabled={busy} className={styles.textButton} onClick={() => void submit(true)}>Save draft</button>}</div>
      <div className={styles.progress} role="progressbar" aria-label="Listing progress" aria-valuemin={1} aria-valuemax={8} aria-valuenow={step + 1} aria-valuetext={`Step ${step + 1} of 8: ${stepTitle}`}>{SELL_STEPS.map((name, index) => <span key={name} data-complete={index <= step || undefined} />)}</div>
      <div className={step === 7 ? styles.reviewWorkspace : styles.workspace}>
        <form noValidate aria-busy={busy} onSubmit={event => { event.preventDefault(); if (step < 7) next(); else if (validateAll()) setSheet("publish"); }} className={styles.form}>
          <fieldset disabled={busy} className={styles.fields}><h2 ref={heading} tabIndex={-1}>{step === 0 ? "How do you want to sell?" : step === 1 ? "Show your item at its best" : step === 2 ? "Find the right category" : step === 3 ? "Tell buyers about your item" : step === 4 ? "What’s its condition?" : step === 5 ? listingType === "auction" ? "Set up your auction" : "Choose your asking price" : step === 6 ? "Where can buyers find it?" : "Preview your listing"}</h2>
            <p className={styles.intro}>{["Choose a format that suits your item.", `Add 1–${MAX_LISTING_IMAGES} clear photos. The first photo is your cover.`, "Help buyers discover your listing in the right place.", "Clear, honest details make a good first impression.", "Use the same condition buyers will see on your listing.", listingType === "auction" ? "Set the opening bid, increment and bidding window." : "Set a price in Malaysian ringgit. Buyers can discuss offers in Chat.", "Only your general area and a selected public meet-up place are shown.", listing && !draft ? "Review your changes before saving." : "Only you can see this preview."][step]}</p>
            {step === 0 && <div className={styles.typeChoices} role="group" aria-label="Listing type"><input type="hidden" {...register("listingType")} /><TypeOption title="Normal listing" description="Set an asking price. Discuss offers in Chat." caption="For new, branded and preloved finds" icon={<ShoppingBag size={27} />} active={listingType === "buy_now"} disabled={Boolean(listing && listing.listingType !== "buy_now")} onClick={() => setValue("listingType", "buy_now", { shouldValidate: true, shouldDirty: true })} /><TypeOption title="Auction" description="Let buyers compete with bids." caption="For collectibles and one-of-a-kind items" icon={<Gavel size={27} />} active={listingType === "auction"} disabled={Boolean(listing && listing.listingType !== "auction")} onClick={() => setValue("listingType", "auction", { shouldValidate: true, shouldDirty: true })} />{listing && <p className={styles.helper}>The listing format stays the same when editing.</p>}</div>}
            {step === 1 && <div id="listing-photos"><div className={styles.photoToolbar}><strong>{photos.length} / {MAX_LISTING_IMAGES} photos</strong><span>JPEG, PNG, WebP · 8 MB each</span></div><div className={styles.photoGrid}>{photos.map((photo, index) => <article key={photo.id} className={styles.photo}><div className={styles.photoImage}>{photo.failed ? <div className={styles.failedPhoto}><Camera size={24} /><span>Photo couldn’t be read</span></div> : <Image src={photo.url} alt={`Listing photo ${index + 1}`} fill sizes="180px" unoptimized className="object-cover" onError={() => setPhotos(current => current.map(item => item.id === photo.id ? { ...item, failed: true } : item))} />}{index === 0 && <span className={styles.cover}>Cover</span>}<button type="button" aria-label={`Remove image ${index + 1}`} onClick={() => removePhoto(photo)} className={styles.removePhoto}><X size={17} /></button></div><div className={styles.photoControls}><button type="button" disabled={index === 0} onClick={() => movePhoto(index, index - 1)} aria-label={`Move image ${index + 1} earlier`}><ArrowLeft size={16} /></button><button type="button" disabled={index === photos.length - 1} onClick={() => movePhoto(index, index + 1)} aria-label={`Move image ${index + 1} later`}><ArrowRight size={16} /></button><button type="button" disabled={index === 0} onClick={() => movePhoto(index, 0)} aria-label={`Make image ${index + 1} the cover`}>Cover</button></div></article>)}{photos.length < MAX_LISTING_IMAGES && <label className={styles.addPhoto}><ImagePlus size={30} /><strong>Add photos</strong><span>Choose from your device</span><input type="file" multiple accept="image/jpeg,image/png,image/webp" aria-label="Add photos" className="sr-only" onChange={event => { addPhotos(event.target.files); event.target.value = ""; }} /></label>}</div><p className={styles.helper}>Reorder with the arrows, or choose a cover. Photos upload when you save or publish.</p>{photoError && <p className={styles.error} role="alert">{photoError}</p>}</div>}
            {step === 2 && <><label className="form-field"><span>Search categories</span><input type="search" value={categorySearch} onChange={event => setCategorySearch(event.target.value)} placeholder="Try electronics, fashion…" /></label><input type="hidden" {...register("categoryId")} /><div className={styles.categoryGrid} role="group" aria-label="Category (required)" aria-describedby={errors.categoryId ? "category-error" : undefined}>{categories.filter(category => category.name.toLowerCase().includes(categorySearch.trim().toLowerCase())).map(category => <button type="button" key={category.id} aria-pressed={preview.categoryId === category.id} onClick={() => { setValue("categoryId", category.id, { shouldDirty: true }); clearErrors("categoryId"); }}><span className={styles.categoryIcon}>{category.icon.startsWith("/") ? <Image src={category.icon} alt="" width={44} height={44} /> : <Wrench size={25} />}</span><span>{category.name}</span>{preview.categoryId === category.id ? <CheckCircle2 size={18} /> : <ChevronRight size={17} />}</button>)}</div>{!categories.some(category => category.name.toLowerCase().includes(categorySearch.trim().toLowerCase())) && <p className={styles.helper}>No categories match. Try another search.</p>}{errors.categoryId && <p id="category-error" className={styles.error} role="alert">{errors.categoryId.message}</p>}</>}
            {step === 3 && <div className={styles.fieldStack}><Field label="Item title" id="sell-title" error={errors.title?.message} hint="Be specific: brand, item and useful details. 6–80 characters."><input id="sell-title" {...register("title")} maxLength={80} placeholder="e.g. Nintendo Switch OLED with controllers" aria-invalid={Boolean(errors.title)} aria-describedby="sell-title-help" /></Field><Field label="Description" id="sell-description" error={errors.description?.message} hint={`${preview.description?.length ?? 0} / 1,200 characters · minimum 20`}><textarea id="sell-description" {...register("description")} maxLength={1200} placeholder="Describe your item, what’s included, condition and anything buyers should know." aria-invalid={Boolean(errors.description)} aria-describedby="sell-description-help" /></Field><p className={styles.note}><ShieldCheck size={19} />Mention any defects or missing parts in your description.</p></div>}
            {step === 4 && <><input type="hidden" {...register("condition")} /><div className={styles.conditionChoices} role="group" aria-label="Condition (required)">{LISTING_CONDITIONS.map(condition => <button type="button" key={condition} aria-pressed={preview.condition === condition} onClick={() => { setValue("condition", condition, { shouldDirty: true }); clearErrors("condition"); }}><span className={styles.choiceMarker}>{preview.condition === condition && <Check size={16} />}</span><span><strong>{condition}</strong><small>{conditionHelp[condition]}</small></span></button>)}</div>{errors.condition && <p role="alert" className={styles.error}>{errors.condition.message}</p>}<p className={styles.helper}>Buyers see this exact condition on Product Detail.</p></>}
            {step === 5 && (listingType === "buy_now" ? <div className={styles.fieldStack}><Field label="Asking price (RM)" id="sell-price" error={errors.price?.message} hint="Enter a positive amount, with up to 2 decimal places."><input type="text" inputMode="decimal" id="sell-price" {...register("price")} placeholder="0.00" aria-invalid={Boolean(errors.price)} aria-describedby="sell-price-help" className={styles.priceInput} /></Field><div className={styles.tip}><ShoppingBag size={21} /><div><strong>Room for a conversation</strong><p>Buyers can send offers through Chat. Agree a price and arrange the exchange together.</p></div></div></div> : <div className={styles.fieldStack}><div className={styles.moneyFields}><Field label="Starting bid (RM)" id="sell-starting-bid" error={errors.startingBid?.message} hint="The minimum opening bid."><input type="text" inputMode="decimal" id="sell-starting-bid" {...register("startingBid")} placeholder="100.00" aria-invalid={Boolean(errors.startingBid)} aria-describedby="sell-starting-bid-help" /></Field><Field label="Minimum increment (RM)" id="sell-increment" error={errors.minimumBidIncrement?.message} hint="The minimum rise for each later bid."><input type="text" inputMode="decimal" id="sell-increment" {...register("minimumBidIncrement")} placeholder="10.00" aria-invalid={Boolean(errors.minimumBidIncrement)} aria-describedby="sell-increment-help" /></Field></div><fieldset className={styles.startChoices}><legend>Auction start <span>Required</span></legend>{!listing && <label><input type="radio" value="now" {...register("startMode")} />Start now</label>}<label><input type="radio" value="scheduled" {...register("startMode")} />Schedule for later</label></fieldset>{preview.startMode === "scheduled" && <Field label="Start date & time" id="sell-start" error={errors.auctionStartAt?.message} hint="Your local time. Schedule up to 90 days ahead."><input id="sell-start" type="datetime-local" {...register("auctionStartAt")} aria-invalid={Boolean(errors.auctionStartAt)} aria-describedby="sell-start-help" /></Field>}{preview.startMode === "now" && errors.auctionStartAt && <p role="alert" className={styles.error}>{errors.auctionStartAt.message}</p>}<Field label="End date & time" id="sell-end" error={errors.auctionEndAt?.message} hint="Bidding must last between 10 minutes and 30 days."><input id="sell-end" type="datetime-local" {...register("auctionEndAt")} aria-invalid={Boolean(errors.auctionEndAt)} aria-describedby="sell-end-help" /></Field><p className={styles.helper}>Times use your device’s local time zone. Once the auction starts or receives a bid, its settings are locked.</p></div>)}
            {step === 6 && <div className={styles.fieldStack}><div className={styles.locationFields}><Field label="District / City" id="sell-city" error={errors.districtOrCity?.message}><input id="sell-city" {...register("districtOrCity")} maxLength={60} placeholder="e.g. Jitra" autoComplete="address-level2" aria-invalid={Boolean(errors.districtOrCity)} aria-describedby={errors.districtOrCity ? "sell-city-help" : undefined} /></Field><Field label="State" id="sell-state" error={errors.state?.message}><select id="sell-state" {...register("state")} aria-invalid={Boolean(errors.state)} aria-describedby={errors.state ? "sell-state-help" : undefined}><option value="">Select state</option>{MALAYSIAN_STATES.map(state => <option key={state}>{state}</option>)}</select></Field></div><p className={styles.note}><MapPin size={19} /><span>Buyers see <strong>{previewLocation ? formatPublicLocation(previewLocation) : "your district or city and state"}</strong>. Do not enter your home address.</span></p><label className={styles.checkLabel}><input type="checkbox" disabled={!profileName} {...register("saveLocationToProfile")} />Save this general area to my public profile</label><label className="form-field"><span>Meet-up location <small>Optional</small></span><select aria-label="Meet-up location (optional)" {...register("meetupLocationId")}><option value="">Arrange a place in Chat</option>{meetups.map(item => <option key={item.id} value={item.id}>{item.name} · {item.area}, {item.state}</option>)}</select></label><p className={styles.helper}>Only a place you explicitly saved is shown. No private address is selected automatically.</p><Link href="/profile/locations" onClick={event => { if (dirty) { event.preventDefault(); setSubmitError("Save your draft before leaving to manage meet-up places. You can also arrange a place in Chat."); } }} className={styles.textButton}>Manage saved meet-up places <ArrowRight size={15} /></Link><div className={styles.tip}><ShieldCheck size={21} /><div><strong>Arrange the exchange together</strong><p>Discuss collection or delivery in Chat. Any availability and costs must be agreed with the buyer. TAKEME does not process buyer-to-seller payments.</p></div></div></div>}
            {step === 7 && <><button type="button" className={styles.reviewEditButton} onClick={() => setSheet("edit")}>Edit a section<ChevronRight size={16} /></button>{previewListing && <div className={styles.detailPreview}><StandardProductDetail key={listingType} listing={previewListing} related={[]} userId={user.uid} created={false} share={async () => {}} shareMessage="" previewMode /></div>}</>}
          </fieldset>
          {submitError && sheet !== "publish" && <p role="alert" className={styles.error}>{submitError}</p>}
          {progress && <p className={styles.helper} role="status" aria-live="polite">{progress}</p>}
          <div className={styles.actions}><button type="button" className="button-secondary" disabled={busy} onClick={() => step ? go(step - 1) : requestExit()}>{step ? "Back" : "Cancel"}</button><button type="submit" disabled={busy} className="button-primary">{busy ? <><LoaderCircle size={17} className="animate-spin" />Saving…</> : step === 7 ? listing && !draft ? "Review changes" : "Ready to publish" : step === 6 ? "Preview listing" : "Continue"}<ArrowRight size={17} /></button></div>
        </form>
        {step !== 7 && <aside className={styles.sidebar}><p className={styles.eyebrow}>Your next marketplace find</p><div className={styles.miniPreview}><div className={styles.miniImage}>{photos[0] && !photos[0].failed ? <Image src={photos[0].url} alt="Your cover photo" fill sizes="320px" unoptimized className="object-contain" /> : <Camera size={36} />}</div><div><small>{preview.categoryId ? getCategoryName(preview.categoryId) : "Your listing"}</small><h3>{preview.title?.trim() || "Something good deserves a new home"}</h3><strong>{listingType === "auction" ? "Starting bid " : ""}{money.format(Number(listingType === "auction" ? preview.startingBid : preview.price) || 0)}</strong><span>{preview.condition}</span><p><MapPin size={13} />{previewLocation ? formatPublicLocation(previewLocation) : "Your general area"}</p></div></div><div className={styles.sidebarTip}><Image src="/brand/mascot-2d-happy.png" alt="" width={70} height={70} /><div><strong>A little detail goes a long way</strong><p>Use your own photos, describe the item honestly, and choose a public place to meet.</p></div></div><p className={styles.helper}>{listing && !draft ? "Your current listing stays visible. Changes appear after you save." : "Save draft is manual. Complete the required details and add a photo first. Nothing is public until you publish."}</p></aside>}
      </div>
    </>}
    {sheet === "edit" && <ActionSheet title="Edit your listing" description="Return to a section. Your other entries stay here." onClose={() => setSheet(null)} fallbackFocus={() => heading.current}><div className={styles.reviewEdits}>{[[1, "Photos"], [2, "Category"], [3, "Details"], [4, "Condition"], [5, "Price & format"], [6, "Meet-up"]].map(([index, label]) => <button type="button" key={index} onClick={() => { setSheet(null); go(Number(index)); }}>Edit {label}<ArrowRight size={15} /></button>)}</div></ActionSheet>}
    {sheet === "publish" && <ActionSheet title={listing && !draft ? "Save these changes?" : "Ready to publish?"} description={listing && !draft ? "The updated details will be visible to buyers." : listingType === "auction" ? "Your auction will be visible on TAKEME. Bids open at its start time." : "Your listing will be visible to buyers on TAKEME."} busy={busy} onClose={() => setSheet(null)}><p className={styles.helper}>Check your photos, condition, price and general area. TAKEME does not process buyer-to-seller payments.</p>{submitError && <p className={styles.error} role="alert">{submitError}</p>}{progress && <p role="status" className={styles.helper}>{progress}</p>}<div className={styles.confirmActions}><button className="button-secondary" type="button" disabled={busy} onClick={() => setSheet(null)}>Keep reviewing</button><button className="button-primary" type="button" disabled={busy} onClick={() => void submit()}>{busy && <LoaderCircle size={17} className="animate-spin" />}{publishLabel}</button></div></ActionSheet>}
    {sheet === "exit" && <ActionSheet title="Leave this listing?" description="Your unsaved entries will be lost. Keep editing, or complete the required details and save a private draft." onClose={() => setSheet(null)}><div className={styles.confirmActions}><button type="button" className="button-primary" onClick={() => setSheet(null)}>Keep editing</button><button type="button" className="button-secondary" onClick={() => { reset(); setPhotos([]); setSheet(null); router.push("/profile/listings"); }}>Discard & leave</button></div></ActionSheet>}
  </div>;
}
function auctionDefaultsToValues() { const dates = auctionDefaults(); return { auctionStartAt: dates.start, auctionEndAt: dates.end }; }
function Field({ label, id, error, hint, children }: { label: string; id: string; error?: string; hint?: string; children: React.ReactNode }) { return <div className="form-field"><label htmlFor={id}>{label} <small className={styles.required}>Required</small></label>{children}{(hint || error) && <span id={`${id}-help`} className={error ? styles.error : styles.helper} role={error ? "alert" : undefined}>{error || hint}</span>}</div>; }
function TypeOption({ title, description, caption, icon, active, disabled, onClick }: { title: string; description: string; caption: string; icon: React.ReactNode; active: boolean; disabled?: boolean; onClick: () => void }) { return <button type="button" disabled={disabled} onClick={onClick} aria-pressed={active} className={styles.typeOption}><span className={styles.typeIcon}>{icon}</span><span><strong>{title}</strong><span>{description}</span><small>{caption}</small></span><span className={styles.choiceMarker}>{active && <Check size={16} />}</span></button>; }
export const listingImageLimits = { maxImages: MAX_LISTING_IMAGES, maxBytes: MAX_IMAGE_BYTES };
