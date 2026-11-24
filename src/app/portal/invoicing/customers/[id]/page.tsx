import CustomerView from "@/settled/pages/CustomerView";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <CustomerView params={params} />;
}
