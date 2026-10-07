import { PortalAssessment } from "@/components/readiness/PortalAssessment";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <PortalAssessment id={(await params).id} />;
}
