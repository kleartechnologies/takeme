"use client";
import { mediaPipelineEnabled, prepareServerPhoto, serverPhotoPreview, serverReadyPhotoPreview, preparedMedia } from "@/lib/services/listing-media";
import { retainedListingMedia } from "@/lib/listing-media";
import { mediaPhotoProgress, mediaPhotoFailure } from "@/lib/media-photo-state";

import { ArrowLeft, ArrowRight, Camera, Check, CheckCircle2, ChevronRight, Gavel, ImagePlus, LoaderCircle, MapPin, ShieldCheck, ShoppingBag, Wrench, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useAuth, useProtectedMarketplaceAction } from "@/components/auth/auth-provider";
import { StandardProductDetail } from "@/components/listings/standard-product-detail";
import { ActionSheet } from "@/components/ui/action-sheet";
import { FirebaseSetupState, SignInRequired } from "@/components/ui/firebase-state";
import { categories, getCategoryName } from "@/data/categories";
import { LISTING_CONDITIONS, MAX_IMAGE_BYTES, MAX_LISTING_IMAGES, senToRinggit } from "@/lib/listing-validation";
import { formatPublicLocation, makePublicLocation, MALAYSIAN_STATES, parseLegacyGeneralLocation } from "@/lib/general-location";
import { CONSUMER_PHOTO_ACCEPT, MAX_CONSUMER_PHOTO_BYTES, photoPreparationIssue } from "@/lib/consumer-photo";
import { prepareConsumerPhoto, preparedPhotoFingerprint, ListingImagePipelineError } from "@/lib/listing-image-upload";
import { getUserProfile, updatePublicProfile } from "@/lib/services/users";
import { listMeetupLocations, type MeetupLocation } from "@/lib/services/locations";
import { submitListingWithRecovery, publishExistingAuctionDraft, publishExistingFixedDraft, updateListing } from "@/lib/services/listings";
import { installSellHistory } from "@/lib/sell-history";
import { newListingSubmission, type ListingSubmissionCheckpoint } from "@/lib/listing-submission";
import { SELL_STEPS, sellInput, validateSellStep, restoredSellStep, incompatibleSellFields, switchedSellValues, type SellValues } from "@/lib/sell-flow";
import { registerUnsavedListingWarning } from "@/lib/unsaved-listing-warning";
import { clearRecovery, readRecoveryFiles, rememberRecoveryFiles, saveRecovery } from "@/lib/transient-recovery";
import { useTransientDraft } from "@/lib/use-transient-draft";
import type { Listing } from "@/types/marketplace";
import styles from "./sell.module.css";

interface PhotoEntry { id: string; url: string; previewUrl?: string; file?: File; existing: boolean; failed?: boolean; preparing?: boolean; retryable?: boolean; name?: string; digest?: string; error?: string; pipelineStatus?: "UPLOADING" | "PROCESSING"; previewFailed?: boolean }
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
  const requireAction = useProtectedMarketplaceAction();
  const recoveryScope = listing ? `/listings/${listing.id}/edit` : "/sell";
  const recovered = useRef(false);
  const [hasRecoveredDraft, setHasRecoveredDraft] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [missingPhotos, setMissingPhotos] = useState(0);
  const defaults = useMemo<SellValues>(() => {
    const dates = auctionDefaults();
    return { title: listing?.title ?? "", categoryId: listing?.categoryId ?? "", condition: listing?.condition ?? "Good", description: listing?.description ?? "", price: listing?.listingType === "buy_now" ? String(listing.price) : "", districtOrCity: listing?.publicLocation?.districtOrCity ?? "", state: listing?.publicLocation?.state ?? "", meetupLocationId: listing?.meetupLocationId ?? "", saveLocationToProfile: false, listingType: listing?.listingType === "auction" ? "auction" : "buy_now", startingBid: listing?.startingBid ? senToRinggit(listing.startingBid) : "", minimumBidIncrement: listing?.minimumBidIncrement ? senToRinggit(listing.minimumBidIncrement) : "", auctionStartAt: listing?.auctionStartAt ? localDateTime(listing.auctionStartAt) : dates.start, auctionEndAt: listing?.auctionEndAt ? localDateTime(listing.auctionEndAt) : dates.end, startMode: listing ? "scheduled" : "now" };
  }, [listing]);
  const [photos, setPhotos] = useState<PhotoEntry[]>(() => listing?.imageUrls.map(url => ({ id: url, url, existing: true, preparing: mediaPipelineEnabled && !!retainedListingMedia(listing, url, process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "") })) ?? []);
  const photoUrls = useRef(new Set<string>());
  const [photoError, setPhotoError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [progress, setProgress] = useState("");
  const [step, setStep] = useState(listing ? 2 : 0);
  const submission = useRef<ListingSubmissionCheckpoint>(newListingSubmission(defaults.listingType));
  const stageHistory = useRef<ReturnType<typeof installSellHistory> | null>(null);
  const restoredStage = useRef(listing ? 2 : 0);
  const historyCallbacks = useRef<{ exit: () => void; blocked: () => boolean }>({ exit: () => {}, blocked: () => false });
  const queuedPhotoBytes = useRef(0);
  const preparingPhotos = useRef(new Set<string>());
  const replacePhotoInputs = useRef(new Map<string, HTMLInputElement>());
  const preparationQueue = useRef(Promise.resolve());
  const photoGeneration = useRef(0);
  const [switchType, setSwitchType] = useState<SellValues["listingType"] | null>(null);
  const dragPhoto = useRef<string | null>(null);
  const [previewAt, setPreviewAt] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const [focusStep, setFocusStep] = useState(0);
  const [categorySearch, setCategorySearch] = useState("");
  const [meetups, setMeetups] = useState<MeetupLocation[]>([]);
  const [profileName, setProfileName] = useState("");
  const [sheet, setSheet] = useState<"publish" | "exit" | "edit" | null>(null);
  const [shareMessage, setShareMessage] = useState("");
  const [result, setResult] = useState<{ id: string; draft: boolean; scheduled: boolean; auction: boolean } | null>(null);
  const { register, control, setValue, getValues, setError, clearErrors, reset, formState: { errors, isDirty } } = useForm<SellValues>({ defaultValues: defaults });
  const listingType = useWatch({ control, name: "listingType" });
  const preview = useWatch({ control }) as SellValues;
  const previewLocation = makePublicLocation(preview.districtOrCity ?? "", preview.state ?? "");
  const photoChanged = !result && (photos.some((photo, index) => photo.file || photo.url !== listing?.imageUrls[index]) || photos.length !== (listing?.imageUrls.length ?? 0));
  const dirty = isDirty || photoChanged;

  const recoveryReady = useTransientDraft(recoveryScope, user?.uid ?? null, dirty || hasRecoveredDraft ? {
    kind: "sell", flowVersion: 2, submission: submission.current, values: { ...preview, saveLocationToProfile: false }, step,
    photoCount: photos.filter(photo => !photo.existing).length + missingPhotos,
  } : null, value => {
    if (value.kind !== "sell" || !user) return;
    submission.current = value.submission ?? newListingSubmission(value.values.listingType);
    recovered.current = true; setHasRecoveredDraft(true);
    reset(value.values); restoredStage.current = restoredSellStep(value.step, value.flowVersion); setStep(restoredStage.current); setSheet(null);
    const retained = readRecoveryFiles(recoveryScope, user.uid);
    const restoredPhotos = retained.map(file => {
      const url = URL.createObjectURL(file); photoUrls.current.add(url);
      return { id: crypto.randomUUID(), url, file, digest: mediaPipelineEnabled ? preparedMedia(file)?.digest : preparedPhotoFingerprint(file), existing: false, preparing: mediaPipelineEnabled };
    });
    setPhotos(current => [...current.filter(photo => photo.existing), ...restoredPhotos]);
    const generation = photoGeneration.current;
    if (mediaPipelineEnabled) for (const photo of restoredPhotos) {
      // Restore only an already-ready preview. Authentication/policy recovery
      // never silently issues a new permit or repeats an upload.
      const ready = preparedMedia(photo.file);
      if (!ready) {
        setPhotos(current => current.map(item => item.id === photo.id ? { ...item, preparing: false, failed: true, error: "Reselect this photo to prepare it again." } : item));
        continue;
      }
      void serverPhotoPreview(photo.file).then(blob => {
        if (generation !== photoGeneration.current) return;
        const url = URL.createObjectURL(blob); photoUrls.current.add(url);
        URL.revokeObjectURL(photo.url); photoUrls.current.delete(photo.url);
        setPhotos(current => {
          if (!current.some(item => item.id === photo.id)) { URL.revokeObjectURL(url); photoUrls.current.delete(url); return current; }
          return current.map(item => item.id === photo.id ? { ...item, url, preparing: false, failed: false } : item);
        });
      }).catch(() => { if (generation === photoGeneration.current) setPhotos(current => current.map(item => item.id === photo.id ? { ...item, preparing: false, failed: true } : item)); });
    }
    const missing = Math.max(0, value.photoCount - retained.length); setMissingPhotos(missing);
    if (missing) { restoredStage.current = 0; setStep(0); }
    setRecoveryMessage(missing ? "Your listing entries are restored. Please reselect your photos; the browser could not retain those files. Nothing has been published." : "Your listing draft is restored. Review it before saving or publishing.");
  }, !!user && !loading && !result);
  useEffect(() => {
    // Initial empty form state must not overwrite files before recovery reads them.
    if (recoveryReady && user && !result) rememberRecoveryFiles(recoveryScope, user.uid, photos.flatMap(photo => photo.file ? [photo.file] : []));
  }, [user, result, photos, recoveryScope, recoveryReady]);

  useEffect(() => {
    if (!mediaPipelineEnabled || !listing || listing.sellerId !== user?.uid) return;
    let active = true;
    for (const originalUrl of listing.imageUrls) {
      const media = retainedListingMedia(listing, originalUrl, process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "");
      if (!media) continue;
      void serverReadyPhotoPreview(media).then(blob => {
        if (!active) return;
        const previewUrl = URL.createObjectURL(blob); photoUrls.current.add(previewUrl);
        setPhotos(current => {
          if (!current.some(photo => photo.existing && photo.url === originalUrl)) { URL.revokeObjectURL(previewUrl); photoUrls.current.delete(previewUrl); return current; }
          return current.map(photo => photo.existing && photo.url === originalUrl ? { ...photo, previewUrl, preparing: false, failed: false } : photo);
        });
      }).catch(() => {
        if (active) setPhotos(current => current.map(photo => photo.existing && photo.url === originalUrl ? { ...photo, preparing: false, failed: true, error: "This photo could not be loaded. Reopen the draft or replace it." } : photo));
      });
    }
    return () => { active = false; };
  }, [listing, user?.uid]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all([getUserProfile(user.uid), listMeetupLocations()]).then(([profile, savedMeetups]) => {
      if (!active) return;
      setMeetups(savedMeetups); setProfileName(profile?.displayName ?? user.displayName ?? "TAKEME member");
      if (!listing && !recovered.current) {
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
    const generation = photoGeneration;
    return () => { generation.current++; for (const url of urls) URL.revokeObjectURL(url); };
  }, []);

  useEffect(() => { historyCallbacks.current = { exit: requestExit, blocked: () => inFlight.current || Boolean(result) }; });
  const ownerId = user?.uid;
  useEffect(() => {
    if (!recoveryReady || !ownerId) return;
    const history = installSellHistory(window, recoveryScope, restoredStage.current,
      next => { if (next === 3) setPreviewAt(Date.now()); setStep(next); setFocusStep(n => n + 1); },
      () => historyCallbacks.current.exit(), () => historyCallbacks.current.blocked());
    stageHistory.current = history;
    return () => { history.cleanup(); stageHistory.current = null; };
  }, [recoveryReady, recoveryScope, ownerId]);
  function go(next: number) { if (stageHistory.current) stageHistory.current.go(next); else { if (next === 3) setPreviewAt(Date.now()); setStep(next); setFocusStep(n => n + 1); } }
  function addPhotos(files: FileList | null, replacementId?: string) {
    if (!files?.length) return;
    const count = replacementId ? photos.length - 1 : photos.length;
    const available = MAX_LISTING_IMAGES - count;
    const incoming = Array.from(files).slice(0, replacementId ? 1 : available);
    if (files.length > available) setPhotoError(`You can keep up to ${MAX_LISTING_IMAGES} photos. The extra photos were not added.`);
    else setPhotoError("");
    const entries = incoming.map(file => ({ id: crypto.randomUUID(), url: mediaPipelineEnabled ? URL.createObjectURL(file) : "", file: mediaPipelineEnabled ? file : undefined, existing: false, preparing: true, name: file.name }));
    for (const entry of entries) if (entry.url) photoUrls.current.add(entry.url);
    if (replacementId) {
      const old = photos.find(photo => photo.id === replacementId);
      if (old?.previewUrl) { URL.revokeObjectURL(old.previewUrl); photoUrls.current.delete(old.previewUrl); }
      if (old?.url && !old.existing) { URL.revokeObjectURL(old.url); photoUrls.current.delete(old.url); }
      setPhotos(current => current.map(photo => photo.id === replacementId ? entries[0] : photo));
    } else setPhotos(current => [...current, ...entries]);
    setMissingPhotos(count => Math.max(0, count - incoming.length));
    incoming.forEach((file, index) => {
      preparePhoto(file, entries[index].id, entries[index].url);
    });
  }
  function preparePhoto(file: File, id: string, originalPreview: string) {
    if (preparingPhotos.current.has(id)) return;
    const generation = photoGeneration.current;
    const permittedSize = file.size > 0 && file.size <= MAX_CONSUMER_PHOTO_BYTES && queuedPhotoBytes.current + file.size <= 60 * 1024 * 1024;
    if (!permittedSize) { setPhotos(current => current.map(photo => photo.id === id ? { ...photo, preparing: false, failed: true, retryable: false } : photo)); return; }
    queuedPhotoBytes.current += file.size;
    preparingPhotos.current.add(id);
    const prepare = async () => {
        try {
          if (generation !== photoGeneration.current) return;
          const normalized = mediaPipelineEnabled
            ? (await prepareServerPhoto(file, id, pipelineStatus => setPhotos(current => current.map(photo => photo.id === id ? { ...photo, pipelineStatus } : photo))), file)
            : await prepareConsumerPhoto(file);
          if (generation !== photoGeneration.current) return;
          const preview = mediaPipelineEnabled ? await serverPhotoPreview(normalized) : normalized;
          const url = URL.createObjectURL(preview); photoUrls.current.add(url);
          if (originalPreview) { URL.revokeObjectURL(originalPreview); photoUrls.current.delete(originalPreview); }
          setPhotos(current => {
            if (!current.some(photo => photo.id === id)) { URL.revokeObjectURL(url); photoUrls.current.delete(url); return current; }
            const digest = mediaPipelineEnabled ? preparedMedia(normalized)?.digest : preparedPhotoFingerprint(normalized);
            if (digest && current.some(photo => photo.id !== id && photo.digest === digest)) {
              URL.revokeObjectURL(url); photoUrls.current.delete(url);
              return current.map(photo => photo.id === id ? { ...photo, preparing: false, failed: true, retryable: false, error: "This photo is already included. Remove the duplicate or replace it." } : photo);
            }
            return current.map(photo => photo.id === id ? { ...photo, url, file: normalized, digest, preparing: false, failed: false, retryable: false, error: undefined, previewFailed: false } : photo);
          });
        } catch (error) {
          const failure = mediaPipelineEnabled ? mediaPhotoFailure(error) : { retryable: false, message: error instanceof ListingImagePipelineError ? error.message : undefined };
          if (generation === photoGeneration.current) setPhotos(current => current.map(photo => photo.id === id ? { ...photo, preparing: false, failed: true, retryable: failure.retryable, error: failure.message } : photo));
        }
        finally { queuedPhotoBytes.current -= file.size; preparingPhotos.current.delete(id); }
      };
    if (mediaPipelineEnabled) void prepare(); else preparationQueue.current = preparationQueue.current.then(prepare);
  }
  function retryPhoto(photo: PhotoEntry) {
    if (!mediaPipelineEnabled || photo.preparing || busy) return;
    if (!photo.retryable) { replacePhotoInputs.current.get(photo.id)?.click(); return; }
    if (!photo.file) return;
    // Same File/operation ID: a lost response cannot issue a second image upload.
    setPhotos(current => current.map(item => item.id === photo.id ? { ...item, preparing: true, failed: false, retryable: false, error: undefined } : item));
    preparePhoto(photo.file, photo.id, photo.url);
  }
  function chooseType(type: SellValues["listingType"]) {
    if (listing || type === listingType) return;
    if (submission.current.creationAttempted) { setPhotoError("The draft already has a listing type. Resume it in My Listings before changing type."); return; }
    if (incompatibleSellFields(getValues(), type)) { setSwitchType(type); return; }
    submission.current = newListingSubmission(type);
    reset(switchedSellValues(getValues(), type), { keepDefaultValues: true });
  }
  function removePhoto(photo: PhotoEntry) {
    if (photo.previewUrl) { URL.revokeObjectURL(photo.previewUrl); photoUrls.current.delete(photo.previewUrl); }
    if (!photo.existing) { URL.revokeObjectURL(photo.url); photoUrls.current.delete(photo.url); }
    setPhotos(current => current.filter(item => item.id !== photo.id));
  }
  function movePhoto(index: number, target: number) {
    setPhotos(current => { const next = [...current]; const [photo] = next.splice(index, 1); next.splice(target, 0, photo); return next; });
  }
  function validateStep(index: number) {
    if (index === 0) { const message = photos.length + missingPhotos ? "" : "Add at least one photo."; setPhotoError(message); return !message; }
    const found = validateSellStep(getValues(), index);
    for (const [name, message] of Object.entries(found)) setError(name as keyof SellValues, { type: "validate", message });
    return Object.keys(found).length === 0;
  }
  function validateAll() {
    clearErrors(); setSubmitError("");
    const photoIssue = photoPreparationIssue(photos, missingPhotos);
    if (photoIssue) { setPhotoError(photoIssue); go(0); return false; }
    for (let index = 0; index < 3; index++) if (!validateStep(index)) { go(index); return false; }
    return true;
  }
  function next() {
    clearErrors(); setSubmitError("");
    // Review is read-only; preparation must block publication, not editing/review.
    if (step === 2 && mediaPipelineEnabled) {
      for (let index = 0; index < 3; index++) if (!validateStep(index)) { go(index); setFocusStep(n => n + 1); return; }
      go(3);
    } else if (step === 2 ? validateAll() : validateStep(step)) go(Math.min(3, step + 1)); else setFocusStep(n => n + 1);
  }
  function requestExit() { if (dirty && !result) setSheet("exit"); else router.push("/profile/listings"); }
  function checkpointSubmission() {
    if (user) saveRecovery(recoveryScope, user.uid, { kind: "sell", flowVersion: 2, submission: submission.current, values: { ...getValues(), saveLocationToProfile: false }, step, photoCount: photos.filter(photo => !photo.existing).length + missingPhotos });
  }
  async function submit(saveDraft = false) {
    if (!user || inFlight.current) return;
    if (!validateAll()) { setSheet(null); return; }
    if (photos.some(photo => photo.preparing)) { setPhotoError("Your photos are still preparing. You can keep editing."); go(0); setSheet(null); return; }
    const values = getValues();
    if (saveDraft && values.listingType === "auction" && values.startMode === "now") {
      setError("auctionStartAt", { message: "Choose Schedule for later to save a resumable auction draft." }); go(2); return;
    }
    const input = sellInput(values);
    inFlight.current = true; setBusy(true); setSubmitError(""); setProgress(saveDraft ? "Saving your draft…" : "Publishing… Uploading your prepared photos.");
    try {
      if (!await requireAction(recoveryScope)) return;
      if (values.saveLocationToProfile) await updatePublicProfile({ displayName: profileName, location: formatPublicLocation(input.publicLocation) });
      let id: string;
      if (saveDraft) {
        if (listing) { await updateListing(listing.id, input, photos); id = listing.id; }
        else id = await submitListingWithRecovery(input, photos.flatMap(photo => photo.file ? [photo.file] : []), submission.current, true, checkpointSubmission);
      } else if (auctionDraft && listing) {
        await publishExistingAuctionDraft(listing.id, input, photos); id = listing.id;
      } else if (draft && listing) {
        await publishExistingFixedDraft(listing.id, input, photos); id = listing.id;
      } else if (listing) {
        await updateListing(listing.id, input, photos); id = listing.id;
      } else id = await submitListingWithRecovery(input, photos.flatMap(photo => photo.file ? [photo.file] : []), submission.current, false, checkpointSubmission);
      clearRecovery(recoveryScope); recovered.current = false; setHasRecoveredDraft(false); setRecoveryMessage(""); setMissingPhotos(0);
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
  const stepTitle = SELL_STEPS[step];
  const selectedMeetup = meetups.find(item => item.id === preview.meetupLocationId);
  let previewListing: Listing | null = null;
  if (step === 3 && previewLocation) {
    const input = sellInput(preview, previewAt);
    previewListing = { ...input, id: listing?.id ?? "unpublished-preview", sellerId: user.uid, imageUrls: photos.filter(photo => !photo.preparing && !photo.failed).map(photo => photo.previewUrl ?? photo.url), location: formatPublicLocation(previewLocation), price: input.listingType === "buy_now" ? input.price : 0, status: "active", createdAt: listing?.createdAt ?? new Date(previewAt).toISOString(), updatedAt: new Date(previewAt).toISOString(), meetupLocation: selectedMeetup ? { name: selectedMeetup.name, area: selectedMeetup.area, state: selectedMeetup.state, country: "Malaysia" } : null, ...(input.listingType === "auction" ? { bidCount: 0, currentBid: 0, auctionStatus: Date.parse(input.auctionStartAt) > previewAt ? "scheduled" : "active" } : {}) };
  }
  const publishLabel = auctionDraft ? "Publish draft auction" : listing && !draft ? "Save changes" : listingType === "auction" ? "Publish auction" : "Publish listing";
  const photoProgress = mediaPhotoProgress(photos, missingPhotos);

  return <div className={styles.flow} data-sell-flow>
    {recoveryMessage && !result && <p role="status" className={styles.helper}>{recoveryMessage}</p>}
    {!mediaPipelineEnabled && step > 0 && !result && photos.some(photo => photo.preparing || photo.failed) && <p role="status" className={styles.helper}>{photos.some(photo => photo.failed) ? "A photo couldn’t be processed." : "Your photos are preparing while you edit."} <button type="button" className={styles.textButton} onClick={() => go(0)}>Review photos</button></p>}
    {mediaPipelineEnabled && !result && photoProgress.total > 0 && <section className={styles.photoProgress} aria-label="Photo preparation"><div><strong role="status" aria-live="polite">{step === 0 && photoProgress.pending ? "Preparing photos…" : photoProgress.label}</strong>{photoProgress.failed > 0 && <span>{photoProgress.failed} {photoProgress.failed === 1 ? "photo needs" : "photos need"} attention</span>}</div><progress value={photoProgress.ready} max={photoProgress.total} aria-label="Photos ready" /><p>{photoProgress.pending ? step === 3 ? `Preparing ${photoProgress.pending} remaining ${photoProgress.pending === 1 ? "photo" : "photos"}… You can review your details while you wait.` : "Large photos may take a little longer. Keep this page open; you can continue editing your listing." : photoProgress.failed ? "Retry a connection failure, or replace/remove the affected photo. Your ready photos are kept." : "Your photos are ready for review."}</p>{step > 0 && (photoProgress.pending > 0 || photoProgress.failed > 0) && <button type="button" className={styles.textButton} onClick={() => go(0)}>Review photos</button>}</section>}
    <header className={styles.header}><button type="button" className="icon-button" disabled={busy} aria-label={step && !result ? "Previous step" : "Exit listing flow"} onClick={() => step && !result ? go(step - 1) : requestExit()}><ArrowLeft size={21} /></button><Image src="/brand/takeme-wordmark.png" alt="TAKEME" width={108} height={36} /><button type="button" className="icon-button" disabled={busy} aria-label="Close listing flow" onClick={requestExit}><X size={21} /></button></header>
    {result ? <section className={styles.success}><Image src={result.draft ? "/brand/mascot-2d-happy.png" : "/brand/mascot-3d-excited.png"} alt="" width={190} height={190} priority /><p className={styles.eyebrow}>{result.draft ? "Safe in your drafts" : listing && !draft ? "Listing updated" : "A new find on TAKEME"}</p><h1 ref={heading} tabIndex={-1}>{title}</h1><p>{result.draft ? "Your listing is private. Resume it from My Listings when you’re ready." : result.scheduled ? `Buyers can discover your auction. Bidding opens ${new Date(preview.auctionStartAt).toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" })}.` : listing && !draft ? "Your updated details are now visible to buyers." : "Buyers can now discover your item and contact you on TAKEME."}</p><div className={styles.successActions}><Link className="button-primary" href={result.draft ? `/listings/${result.id}/edit` : `/listings/${result.id}`}>{result.draft ? "Resume draft" : result.auction ? "View auction" : "View listing"}<ArrowRight size={17} /></Link>{!result.draft && <button type="button" className="button-secondary" onClick={async () => {
        try { const url = `${window.location.origin}/listings/${result.id}`; if (navigator.share) await navigator.share({ title: getValues().title, url }); else { await navigator.clipboard.writeText(url); setShareMessage("Listing link copied."); } }
        catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) setShareMessage("The link could not be shared. Open your listing to share it."); }
      }}>Share listing</button>}{shareMessage && <p role="status">{shareMessage}</p>}<Link className="button-secondary" href={`/profile/listings${result.draft ? "?tab=drafts" : ""}`}>My listings</Link><button type="button" className={styles.textButton} onClick={() => { if (listing) router.push("/sell"); else { photoGeneration.current++; for (const url of photoUrls.current) URL.revokeObjectURL(url); photoUrls.current.clear(); setShareMessage(""); setSubmitError(""); submission.current = newListingSubmission(getValues().listingType); reset({ ...defaults, ...auctionDefaultsToValues(), listingType: getValues().listingType, condition: getValues().condition, districtOrCity: getValues().districtOrCity, state: getValues().state, meetupLocationId: getValues().meetupLocationId }); setPhotos([]); setPhotoError(""); setResult(null); setTimeout(() => go(0), 0); } }}>Sell another</button></div></section> : <>
      <div className={styles.progressHeader}><div><h1>{title}</h1><p>Step {step + 1} of {SELL_STEPS.length} <span>· {stepTitle}</span></p></div>{(!listing || draft) && <button type="button" disabled={busy} className={styles.textButton} onClick={() => void submit(true)}>Save draft</button>}</div>
      <div className={styles.progress} role="progressbar" aria-label="Listing progress" aria-valuemin={1} aria-valuemax={SELL_STEPS.length} aria-valuenow={step + 1} aria-valuetext={`Step ${step + 1} of ${SELL_STEPS.length}: ${stepTitle}`}>{SELL_STEPS.map((name, index) => <span key={name} data-complete={index <= step || undefined} />)}</div>
      <div className={step === 3 ? styles.reviewWorkspace : styles.workspace}>
        <form noValidate aria-busy={busy} onSubmit={event => { event.preventDefault(); if (step < 3) next(); else if (validateAll()) setSheet("publish"); }} className={styles.form} onBlur={event => { if (step !== 2) return; const name = (event.target as unknown as HTMLInputElement).name as keyof SellValues; if (!name) return; const found = validateSellStep(getValues(), 2); if (found[name]) setError(name, { type: "validate", message: found[name] }); else clearErrors(name); }}>
          <fieldset disabled={busy} className={styles.fields}><h2 ref={heading} tabIndex={-1}>{["Show your item at its best", "Find the right category", "Tell buyers about your item", "Review your listing"][step]}</h2>
            <p className={styles.intro}>{[`Add 1–${MAX_LISTING_IMAGES} photos. The first photo is your cover.`, "Choose a category to continue straight to details.", "One screen for your item, price and general area.", "Check your photos and details. Nothing is public until you publish."][step]}</p>
            {step === 0 && <div className={styles.typeChoices} role="group" aria-label="Listing type"><input type="hidden" {...register("listingType")} /><TypeOption title="Fixed price" description="Set an asking price. Discuss offers in Chat." caption="For new, branded and preloved finds" icon={<ShoppingBag size={27} />} active={listingType === "buy_now"} disabled={Boolean(listing && listing.listingType !== "buy_now")} onClick={() => chooseType("buy_now")} /><TypeOption title="Auction" description="Let buyers compete with bids." caption="For collectibles and one-of-a-kind items" icon={<Gavel size={27} />} active={listingType === "auction"} disabled={Boolean(listing && listing.listingType !== "auction")} onClick={() => chooseType("auction")} />{listing && <p className={styles.helper}>The listing format stays the same when editing.</p>}</div>}
            {step === 0 && <div id="listing-photos"><div className={styles.photoToolbar}><strong>{photos.length} / {MAX_LISTING_IMAGES} photos{missingPhotos > 0 && ` · ${missingPhotos} to reselect`}</strong><span>JPEG, PNG, WebP, AVIF · {mediaPipelineEnabled ? "Compatible iPhone photos" : "HEIC/HEIF when supported by your device"} · up to 30 MB</span></div><div className={styles.photoGrid}>{photos.map((photo, index) => <article key={photo.id} className={styles.photo} draggable={!busy} onDragStart={() => { dragPhoto.current = photo.id; }} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const source = photos.findIndex(item => item.id === dragPhoto.current); if (source >= 0 && source !== index) movePhoto(source, index); dragPhoto.current = null; }}><div className={styles.photoImage}>{photo.preparing && !photo.existing && mediaPipelineEnabled && photo.url && !photo.previewFailed && <Image src={photo.url} alt={`Selected photo ${index + 1}`} fill sizes="180px" unoptimized className="object-cover" onError={() => setPhotos(current => current.map(item => item.id === photo.id ? { ...item, previewFailed: true } : item))} />}{photo.preparing || photo.failed ? <div className={styles.failedPhoto}>{photo.preparing ? <LoaderCircle size={24} className="animate-spin" /> : <Camera size={24} />}<span>{photo.preparing ? "Preparing…" : (photo.error ?? "We couldn’t process this photo. Tap to replace it.")}</span></div> : <Image src={photo.previewUrl ?? photo.url} alt={`Listing photo ${index + 1}`} fill sizes="180px" unoptimized className="object-cover" onError={() => setPhotos(current => current.map(item => item.id === photo.id ? { ...item, failed: true } : item))} />}{index === 0 && <span className={styles.cover}>Cover</span>}<button type="button" aria-label={`Remove image ${index + 1}`} onClick={() => removePhoto(photo)} className={styles.removePhoto}><X size={17} /></button></div><p className={styles.photoStatus} role="status">{photo.preparing ? photo.pipelineStatus === "UPLOADING" ? "Uploading…" : photo.pipelineStatus === "PROCESSING" ? "Processing…" : "Preparing…" : photo.failed ? "Needs attention" : "Ready"}</p>{mediaPipelineEnabled && photo.failed && <button type="button" className={styles.retryPhoto} disabled={busy} onClick={() => retryPhoto(photo)} aria-label={`Retry image ${index + 1}`}>Retry</button>}<label className={styles.replacePhoto}>Replace<input type="file" accept={CONSUMER_PHOTO_ACCEPT} aria-label={`Replace image ${index + 1}`} ref={element => { if (element) replacePhotoInputs.current.set(photo.id, element); else replacePhotoInputs.current.delete(photo.id); }} className="sr-only" onChange={event => { addPhotos(event.target.files, photo.id); event.target.value = ""; }} /></label><div className={styles.photoControls}><button type="button" disabled={index === 0} onClick={() => movePhoto(index, index - 1)} aria-label={`Move image ${index + 1} earlier`}><ArrowLeft size={16} /></button><button type="button" disabled={index === photos.length - 1} onClick={() => movePhoto(index, index + 1)} aria-label={`Move image ${index + 1} later`}><ArrowRight size={16} /></button><button type="button" disabled={index === 0} onClick={() => movePhoto(index, 0)} aria-label={`Make image ${index + 1} the cover`}>Cover</button></div></article>)}{Array.from({ length: missingPhotos }, (_, index) => <article key={`missing-${index}`} className={styles.photo}><div className={styles.photoImage}><div className={styles.failedPhoto}><Camera size={24} /><span>Reselect this photo. Its file was not retained by the browser.</span></div><button type="button" aria-label={`Remove missing photo ${index + 1}`} className={styles.removePhoto} onClick={() => setMissingPhotos(count => Math.max(0, count - 1))}><X size={17} /></button></div><label className={styles.replacePhoto}>Reselect<input type="file" accept={CONSUMER_PHOTO_ACCEPT} aria-label={`Reselect missing photo ${index + 1}`} className="sr-only" onChange={event => { addPhotos(event.target.files); event.target.value = ""; }} /></label></article>)}{photos.length < MAX_LISTING_IMAGES && <label className={styles.addPhoto}><ImagePlus size={30} /><strong>Add photos</strong><span>Choose from your device</span><input type="file" multiple accept={CONSUMER_PHOTO_ACCEPT} aria-label="Add photos" className="sr-only" onChange={event => { addPhotos(event.target.files); event.target.value = ""; }} /></label>}</div><p className={styles.helper}>{mediaPipelineEnabled ? "Photos upload and process while you fill in the details." : "Photos prepare while you fill in the details and upload only when you save or publish."} Drag to reorder, or use the arrows and cover controls.</p>{photoError && <p className={styles.error} role="alert">{photoError}</p>}</div>}
            {step === 1 && <><label className="form-field"><span>Search categories</span><input type="search" value={categorySearch} onChange={event => setCategorySearch(event.target.value)} placeholder="Try electronics, fashion…" /></label><input type="hidden" {...register("categoryId")} /><div className={styles.categoryGrid} role="group" aria-label="Category (required)" aria-describedby={errors.categoryId ? "category-error" : undefined}>{categories.filter(category => category.name.toLowerCase().includes(categorySearch.trim().toLowerCase())).map(category => <button type="button" key={category.id} aria-pressed={preview.categoryId === category.id} onClick={() => { setValue("categoryId", category.id, { shouldDirty: true }); clearErrors("categoryId"); go(2); }}><span className={styles.categoryIcon}>{category.icon.startsWith("/") ? <Image src={category.icon} alt="" width={44} height={44} /> : <Wrench size={25} />}</span><span>{category.name}</span>{preview.categoryId === category.id ? <CheckCircle2 size={18} /> : <ChevronRight size={17} />}</button>)}</div>{!categories.some(category => category.name.toLowerCase().includes(categorySearch.trim().toLowerCase())) && <p className={styles.helper}>No categories match. Try another search.</p>}{errors.categoryId && <p id="category-error" className={styles.error} role="alert">{errors.categoryId.message}</p>}</>}
            {step === 2 && <div className={styles.fieldStack}><Field label="Item title" id="sell-title" error={errors.title?.message} hint="Be specific: brand, item and useful details. 6–80 characters."><input id="sell-title" {...register("title")} maxLength={80} placeholder="e.g. Nintendo Switch OLED with controllers" aria-invalid={Boolean(errors.title)} aria-describedby="sell-title-help" /></Field></div>}
            {step === 2 && <><h3 className={styles.sectionTitle}>Condition</h3><input type="hidden" {...register("condition")} /><div className={styles.conditionChoices} role="group" aria-label="Condition (required)">{LISTING_CONDITIONS.map(condition => <button type="button" key={condition} aria-pressed={preview.condition === condition} onClick={() => { setValue("condition", condition, { shouldDirty: true }); clearErrors("condition"); }}><span className={styles.choiceMarker}>{preview.condition === condition && <Check size={16} />}</span><span><strong>{condition}</strong><small>{conditionHelp[condition]}</small></span></button>)}</div>{errors.condition && <p role="alert" className={styles.error}>{errors.condition.message}</p>}<p className={styles.helper}>Buyers see this exact condition on Product Detail.</p></>}
            {step === 2 && <div className={styles.fieldStack}><Field label="Description" id="sell-description" error={errors.description?.message} hint={`${preview.description?.length ?? 0} / 1,200 characters · minimum 20`}><textarea id="sell-description" {...register("description")} maxLength={1200} placeholder="Describe your item, what’s included, condition and anything buyers should know." aria-invalid={Boolean(errors.description)} aria-describedby="sell-description-help" /></Field><p className={styles.note}><ShieldCheck size={19} />Mention any defects or missing parts in your description.</p></div>}
            {step === 2 && (listingType === "buy_now" ? <div className={styles.fieldStack}><Field label="Asking price (RM)" id="sell-price" error={errors.price?.message} hint="Enter a positive amount, with up to 2 decimal places."><input type="text" inputMode="decimal" id="sell-price" {...register("price")} placeholder="0.00" aria-invalid={Boolean(errors.price)} aria-describedby="sell-price-help" className={styles.priceInput} /></Field><div className={styles.tip}><ShoppingBag size={21} /><div><strong>Room for a conversation</strong><p>Buyers can send offers through Chat. Agree a price and arrange the exchange together.</p></div></div></div> : <div className={styles.fieldStack}><div className={styles.moneyFields}><Field label="Starting bid (RM)" id="sell-starting-bid" error={errors.startingBid?.message} hint="The minimum opening bid."><input type="text" inputMode="decimal" id="sell-starting-bid" {...register("startingBid")} placeholder="100.00" aria-invalid={Boolean(errors.startingBid)} aria-describedby="sell-starting-bid-help" /></Field><Field label="Minimum increment (RM)" id="sell-increment" error={errors.minimumBidIncrement?.message} hint="The minimum rise for each later bid."><input type="text" inputMode="decimal" id="sell-increment" {...register("minimumBidIncrement")} placeholder="10.00" aria-invalid={Boolean(errors.minimumBidIncrement)} aria-describedby="sell-increment-help" /></Field></div><fieldset className={styles.startChoices}><legend>Auction start <span>Required</span></legend>{!listing && <label><input type="radio" value="now" {...register("startMode")} />Start now</label>}<label><input type="radio" value="scheduled" {...register("startMode")} />Schedule for later</label></fieldset>{preview.startMode === "scheduled" && <Field label="Start date & time" id="sell-start" error={errors.auctionStartAt?.message} hint="Your local time. Schedule up to 90 days ahead."><input id="sell-start" type="datetime-local" {...register("auctionStartAt")} aria-invalid={Boolean(errors.auctionStartAt)} aria-describedby="sell-start-help" /></Field>}{preview.startMode === "now" && errors.auctionStartAt && <p role="alert" className={styles.error}>{errors.auctionStartAt.message}</p>}<Field label="End date & time" id="sell-end" error={errors.auctionEndAt?.message} hint="Bidding must last between 10 minutes and 30 days."><input id="sell-end" type="datetime-local" {...register("auctionEndAt")} aria-invalid={Boolean(errors.auctionEndAt)} aria-describedby="sell-end-help" /></Field><p className={styles.helper}>Times use your device’s local time zone. Once the auction starts or receives a bid, its settings are locked.</p></div>)}
            {step === 2 && <div className={styles.fieldStack}><div className={styles.locationFields}><Field label="District / City" id="sell-city" error={errors.districtOrCity?.message}><input id="sell-city" {...register("districtOrCity")} maxLength={60} placeholder="e.g. Jitra" autoComplete="address-level2" aria-invalid={Boolean(errors.districtOrCity)} aria-describedby={errors.districtOrCity ? "sell-city-help" : undefined} /></Field><Field label="State" id="sell-state" error={errors.state?.message}><select id="sell-state" {...register("state")} aria-invalid={Boolean(errors.state)} aria-describedby={errors.state ? "sell-state-help" : undefined}><option value="">Select state</option>{MALAYSIAN_STATES.map(state => <option key={state}>{state}</option>)}</select></Field></div><p className={styles.note}><MapPin size={19} /><span>Buyers see <strong>{previewLocation ? formatPublicLocation(previewLocation) : "your district or city and state"}</strong>. Do not enter your home address.</span></p><label className={styles.checkLabel}><input type="checkbox" disabled={!profileName} {...register("saveLocationToProfile")} />Save this general area to my public profile</label><label className="form-field"><span>Meet-up location <small>Optional</small></span><select aria-label="Meet-up location (optional)" {...register("meetupLocationId")}><option value="">Arrange a place in Chat</option>{meetups.map(item => <option key={item.id} value={item.id}>{item.name} · {item.area}, {item.state}</option>)}</select></label><p className={styles.helper}>Only a place you explicitly saved is shown. No private address is selected automatically.</p><Link href="/profile/locations" onClick={event => { if (dirty) { event.preventDefault(); setSubmitError("Save your draft before leaving to manage meet-up places. You can also arrange a place in Chat."); } }} className={styles.textButton}>Manage saved meet-up places <ArrowRight size={15} /></Link><div className={styles.tip}><ShieldCheck size={21} /><div><strong>Arrange the exchange together</strong><p>Discuss collection or delivery in Chat. Any availability and costs must be agreed with the buyer. TAKEME does not process buyer-to-seller payments.</p></div></div></div>}
            {step === 3 && <><button type="button" className={styles.reviewEditButton} onClick={() => setSheet("edit")}>Edit a section<ChevronRight size={16} /></button>{previewListing && <div className={styles.detailPreview}><StandardProductDetail key={listingType} listing={previewListing} related={[]} userId={user.uid} created={false} share={async () => {}} shareMessage="" previewMode /></div>}</>}
          </fieldset>
          {submitError && sheet !== "publish" && <p role="alert" className={styles.error}>{submitError}</p>}
          {progress && <p className={styles.helper} role="status" aria-live="polite">{progress}</p>}
          <div className={styles.actions}><button type="button" className="button-secondary" disabled={busy} onClick={() => step ? go(step - 1) : requestExit()}>{step ? "Back" : "Cancel"}</button><button type="submit" disabled={busy || (step === 0 && photos.length + missingPhotos === 0) || (step === 3 && Boolean(photoPreparationIssue(photos, missingPhotos)))} className="button-primary">{busy ? <><LoaderCircle size={17} className="animate-spin" />Saving…</> : step === 3 ? listing && !draft ? "Review changes" : "Ready to publish" : step === 2 ? "Review listing" : "Next"}<ArrowRight size={17} /></button></div>
        </form>
        {step !== 3 && <aside className={styles.sidebar}><p className={styles.eyebrow}>Your next marketplace find</p><div className={styles.miniPreview}><div className={styles.miniImage}>{photos[0]?.url && !photos[0].failed ? <Image src={photos[0].previewUrl ?? photos[0].url} alt="Your cover photo" fill sizes="320px" unoptimized className="object-contain" /> : <Camera size={36} />}</div><div><small>{preview.categoryId ? getCategoryName(preview.categoryId) : "Your listing"}</small><h3>{preview.title?.trim() || "Something good deserves a new home"}</h3><strong>{listingType === "auction" ? "Starting bid " : ""}{money.format(Number(listingType === "auction" ? preview.startingBid : preview.price) || 0)}</strong><span>{preview.condition}</span><p><MapPin size={13} />{previewLocation ? formatPublicLocation(previewLocation) : "Your general area"}</p></div></div><div className={styles.sidebarTip}><Image src="/brand/mascot-2d-happy.png" alt="" width={70} height={70} /><div><strong>A little detail goes a long way</strong><p>Use your own photos, describe the item honestly, and choose a public place to meet.</p></div></div><p className={styles.helper}>{listing && !draft ? "Your current listing stays visible. Changes appear after you save." : "Save draft is manual. Complete the required details and add a photo first. Nothing is public until you publish."}</p></aside>}
      </div>
    </>}
    {switchType && <ActionSheet title="Change listing type?" description="Your photos and item details stay. The price and bid amounts will be cleared." onClose={() => setSwitchType(null)}><div className={styles.confirmActions}><button type="button" className="button-secondary" onClick={() => setSwitchType(null)}>Keep current type</button><button type="button" className="button-primary" onClick={() => { submission.current = newListingSubmission(switchType); reset(switchedSellValues(getValues(), switchType), { keepDefaultValues: true }); setSwitchType(null); }}>Change type</button></div></ActionSheet>}
    {sheet === "edit" && <ActionSheet title="Edit your listing" description="Return to a section. Your other entries stay here." onClose={() => setSheet(null)} fallbackFocus={() => heading.current}><div className={styles.reviewEdits}>{[[0, "Photos"], [1, "Category"], [2, "Item details"]].map(([index, label]) => <button type="button" key={index} onClick={() => { setSheet(null); go(Number(index)); }}>Edit {label}<ArrowRight size={15} /></button>)}</div></ActionSheet>}
    {sheet === "publish" && <ActionSheet title={listing && !draft ? "Save these changes?" : "Ready to publish?"} description={listing && !draft ? "The updated details will be visible to buyers." : listingType === "auction" ? "Your auction will be visible on TAKEME. Bids open at its start time." : "Your listing will be visible to buyers on TAKEME."} busy={busy} onClose={() => setSheet(null)}><p className={styles.publishSummary}>{photos.length} photos · {preview.condition} · {listingType === "auction" ? "Starting bid " : ""}{money.format(Number(listingType === "auction" ? preview.startingBid : preview.price) || 0)} · {preview.districtOrCity}</p>{submitError && <p className={styles.error} role="alert">{submitError}</p>}{progress && <p role="status" className={styles.helper}>{progress}</p>}<div className={styles.confirmActions}><button className="button-secondary" type="button" disabled={busy} onClick={() => setSheet(null)}>Keep reviewing</button><button className="button-primary" type="button" disabled={busy || photos.some(photo => photo.preparing || photo.failed) || missingPhotos > 0} onClick={() => void submit()}>{busy && <LoaderCircle size={17} className="animate-spin" />}{publishLabel}</button></div></ActionSheet>}
    {sheet === "exit" && <ActionSheet title="Leave this listing?" description="Your entries are kept in this browser for 30 minutes. Discard only if you want to start again." onClose={() => setSheet(null)}><div className={styles.confirmActions}><button type="button" className="button-primary" onClick={() => setSheet(null)}>Keep editing</button><button type="button" className="button-secondary" onClick={() => { clearRecovery(recoveryScope); recovered.current = false; setHasRecoveredDraft(false); photoGeneration.current++; reset(); setPhotos([]); setSheet(null); router.push("/profile/listings"); }}>Discard & leave</button><button type="button" className="button-secondary" onClick={() => { setSheet(null); router.push("/profile/listings"); }}>Leave & keep entries</button></div></ActionSheet>}
  </div>;
}
function auctionDefaultsToValues() { const dates = auctionDefaults(); return { auctionStartAt: dates.start, auctionEndAt: dates.end }; }
function Field({ label, id, error, hint, children }: { label: string; id: string; error?: string; hint?: string; children: React.ReactNode }) { return <div className="form-field"><label htmlFor={id}>{label} <small className={styles.required}>Required</small></label>{children}{(hint || error) && <span id={`${id}-help`} className={error ? styles.error : styles.helper} role={error ? "alert" : undefined}>{error || hint}</span>}</div>; }
function TypeOption({ title, description, caption, icon, active, disabled, onClick }: { title: string; description: string; caption: string; icon: React.ReactNode; active: boolean; disabled?: boolean; onClick: () => void }) { return <button type="button" disabled={disabled} onClick={onClick} aria-pressed={active} className={styles.typeOption}><span className={styles.typeIcon}>{icon}</span><span><strong>{title}</strong><span>{description}</span><small>{caption}</small></span><span className={styles.choiceMarker}>{active && <Check size={16} />}</span></button>; }
export const listingImageLimits = { maxImages: MAX_LISTING_IMAGES, maxBytes: MAX_IMAGE_BYTES };
