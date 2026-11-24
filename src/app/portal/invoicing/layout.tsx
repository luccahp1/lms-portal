import { requireClient } from "@/lib/auth/session";
import { settledAccess } from "@/lib/data/settled";
import { Frame } from "@/settled/shell/Frame";
import { Locked } from "@/settled/Locked";
import "@/settled/styles/bridge.css";
import "@/settled/styles/settled.css";
import "@/settled/styles/frame.css";

export const metadata = { title: "Invoicing" };

/*
  Invoicing (Settled) is a paid add-on. Without it every page here shows the locked page; with it,
  the Settled screens inside their section bar. docs/settled.md.
*/
export default async function InvoicingLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireClient();
  const access = await settledAccess(viewer);
  if (!access.ready) return <Locked enabled={access.enabled} preview={!!viewer.previewBy} />;
  return (
    <Frame person={viewer.name} preview={!!viewer.previewBy}>
      {children}
    </Frame>
  );
}
