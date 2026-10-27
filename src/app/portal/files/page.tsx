import { requireClient } from "@/lib/auth/session";
import { listFiles } from "@/lib/data/files";
import { PageHeader } from "@/components/ui";
import { FileList } from "@/components/features/FileList";
import { UploadForm } from "@/components/features/UploadForm";

export const metadata = { title: "Files & approvals" };

export default async function FilesPage() {
  const viewer = await requireClient();
  const files = await listFiles(viewer);
  return (
    <>
      <PageHeader title="Files & approvals" subtitle="Designs, documents and photos, all in one place." />
      <UploadForm />
      <FileList files={files} viewerRole="client" />
    </>
  );
}
