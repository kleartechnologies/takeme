import { EditListingView } from "@/components/forms/edit-listing-view";
type EditListingPageProps = { params: Promise<{ id: string }> };
export default async function EditListingPage({ params }: EditListingPageProps) { const { id } = await params; return <main><EditListingView id={id} /></main>; }
