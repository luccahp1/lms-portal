import { requireClient } from "@/lib/auth/session";
import { getClient } from "@/lib/data/clients";
import { isInlineImage, listFiles } from "@/lib/data/files";
import { formatBytes } from "@/lib/format";
import { buttonClass, Card, CardTitle, Empty, PageHeader } from "@/components/ui";

export const metadata = { title: "Your brand" };

type BrandFile = Awaited<ReturnType<typeof listFiles>>[number];

function kindOf(f: BrandFile) {
  const n = f.name.toLowerCase();
  if (n.includes("business-card") || n.includes("business card")) return "card";
  if (n.includes("logo")) return "logo";
  return "other";
}

function Preview({ file }: { file: BrandFile }) {
  return (
    <figure className="flex flex-col gap-2">
      {/* Served by /files/<id>?view=1 after the same access check as downloads. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/files/${file.id}?view=1`}
        alt={file.name}
        className="w-full rounded-lg border border-line bg-[repeating-conic-gradient(#f1f1f4_0%_25%,#fff_0%_50%)] bg-[length:16px_16px] object-contain shadow-sm"
      />
      <figcaption className="text-[13px] text-muted">{file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]/g, " ")}</figcaption>
    </figure>
  );
}

function Downloads({ files }: { files: BrandFile[] }) {
  return (
    <ul className="flex flex-col">
      {files.map((f) => (
        <li key={f.id} className="flex items-center justify-between gap-3 border-t border-subtle py-2.5 first:border-t-0">
          <span className="min-w-0 truncate">{f.name}</span>
          <a href={`/files/${f.id}`} className={buttonClass("secondary")}>
            Download <span className="text-xs text-muted">{formatBytes(f.sizeBytes)}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export default async function BrandPage() {
  const viewer = await requireClient();
  const [client, files] = await Promise.all([getClient(viewer), listFiles(viewer, undefined, "brand")]);
  const groups = { card: [] as BrandFile[], logo: [] as BrandFile[], other: [] as BrandFile[] };
  // Front before back, then by name.
  const order = (n: string) => n.toLowerCase().replace("front", "0").replace("back", "1");
  for (const f of [...files].sort((a, b) => order(a.name).localeCompare(order(b.name)))) groups[kindOf(f)].push(f);
  const images = (list: BrandFile[]) => list.filter((f) => isInlineImage(f.mimeType));

  return (
    <>
      <PageHeader title="Your brand" subtitle={`Business card, logos and print files for ${client.name}, ready to download.`} />
      {files.length === 0 && (
        <Card>
          <Empty>Your brand files will appear here once they’re ready.</Empty>
        </Card>
      )}

      {groups.card.length > 0 && (
        <Card>
          <CardTitle>Business card</CardTitle>
          <div className="grid gap-5 sm:grid-cols-2">
            {images(groups.card).map((f) => (
              <Preview key={f.id} file={f} />
            ))}
          </div>
          <p className="mt-4 mb-1 text-[13px] text-muted">
            The print-ready files are below. Send them to any printer, or ask us to reorder for you.
          </p>
          <Downloads files={groups.card} />
        </Card>
      )}

      {groups.logo.length > 0 && (
        <Card>
          <CardTitle>Logos</CardTitle>
          <div className="grid gap-5 sm:grid-cols-3">
            {images(groups.logo).map((f) => (
              <Preview key={f.id} file={f} />
            ))}
          </div>
          <div className="mt-4">
            <Downloads files={groups.logo} />
          </div>
        </Card>
      )}

      {groups.other.length > 0 && (
        <Card>
          <CardTitle>Other brand files</CardTitle>
          <Downloads files={groups.other} />
        </Card>
      )}
    </>
  );
}
