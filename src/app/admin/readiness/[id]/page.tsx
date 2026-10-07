import { AdminAssessment } from "@/components/readiness/AdminAssessment";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <AdminAssessment id={(await params).id} />;
}
