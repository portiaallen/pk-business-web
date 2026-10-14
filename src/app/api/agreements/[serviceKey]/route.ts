import { NextResponse } from "next/server";
import { getPublishedBundle } from "@/lib/agreements";
import { prisma } from "@/lib/prisma";

// Serves the client-facing agreement bundle for a service: the active
// service agreement (when one is published) and every published refund
// policy that applies. Draft policies are intentionally never served here.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ serviceKey: string }> },
) {
  const { serviceKey } = await params;
  if (!/^[A-Z_]{2,64}$/.test(serviceKey))
    return NextResponse.json({ error: "Invalid service key" }, { status: 400 });
  const bundle = await getPublishedBundle(prisma, serviceKey);
  return NextResponse.json({
    serviceKey,
    agreement: bundle.agreement
      ? {
          docKey: bundle.agreement.docKey,
          version: bundle.agreement.version,
          title: bundle.agreement.title,
          body: bundle.agreement.body,
          effectiveAt: bundle.agreement.effectiveAt,
        }
      : null,
    policies: bundle.policies.map((p) => ({
      docKey: p.docKey,
      version: p.version,
      title: p.title,
      body: p.body,
      effectiveAt: p.effectiveAt,
      sourceUrl: p.sourceUrl,
    })),
  });
}
