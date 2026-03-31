import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ workspaceId: string }>;
};

/** Kandidater/prosesser er samlet under Vurderinger med fanen «Prosesser». */
export default async function WorkspaceCandidatesRedirectPage({
  params,
}: PageProps) {
  const { workspaceId } = await params;
  redirect(`/w/${workspaceId}/vurderinger?fane=prosesser`);
}
