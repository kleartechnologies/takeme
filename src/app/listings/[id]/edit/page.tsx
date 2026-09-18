import { EditListingView } from "@/components/forms/edit-listing-view";
type EditListingPageProps = { params: Promise<{ id: string }> };
export default async function EditListingPage({ params }: EditListingPageProps) { const { id } = await params; return <main className="page-shell py-8 md:py-12"><div className="mb-8"><p className="eyebrow">Manage listing</p><h1 className="page-title">Edit your listing</h1><p className="mt-3 text-stone-600">Update the details buyers see in the marketplace.</p></div><EditListingView id={id} /></main>; }
