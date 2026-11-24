import InvoiceView from "@/settled/pages/InvoiceView";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <InvoiceView params={params} />;
}
