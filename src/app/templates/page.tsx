import { TemplateGallery } from "@/components/features/TemplateGallery";
import { fillQuery, TEMPLATES } from "@/lib/templates";

export const metadata = { title: "Website designs", robots: { index: false, follow: false } };

// The ten site designs, public, for showing a prospect in a meeting or sending as a link.
// ?name=&phone=&city= puts their own details on every design.
export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ name?: string; phone?: string; city?: string }> }) {
  const sp = await searchParams;
  const fill = { business: sp.name?.slice(0, 60), phone: sp.phone?.slice(0, 24), city: sp.city?.slice(0, 40) };
  return (
    <main className="mx-auto flex max-w-[1240px] flex-col gap-6 px-4 py-10">
      <header className="k-ph" style={{ marginBottom: 0 }}>
        <div>
          <div className="k-ph__k k-mono">London Marketing Solutions</div>
          <h1>{fill.business ? `Ten ways ${fill.business} could look` : "Ten website designs"}</h1>
          <p>Each one is a starting point. Open any of them to look closer, on a computer or a phone. Photos, colours and wording all become yours.</p>
        </div>
      </header>
      <TemplateGallery templates={TEMPLATES.map(({ slug, name, fits, blurb }) => ({ slug, name, fits, blurb }))} query={fillQuery(fill)} />
    </main>
  );
}
