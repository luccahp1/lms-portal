import { requireAdmin } from "@/lib/auth/session";
import { listFiles } from "@/lib/data/files";
import { FileList } from "@/components/features/FileList";
import { UploadForm } from "@/components/features/UploadForm";

export default async function ClientFiles({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireAdmin();
  const { id } = await params;
  const files = await listFiles(viewer, id);
  return (
    <>
      <UploadForm clientId={id} allowApproval />
      <FileList files={files} viewerRole="agency_admin" />
    </>
  );
}
