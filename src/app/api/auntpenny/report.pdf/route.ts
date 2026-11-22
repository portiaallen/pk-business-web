import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSandbox, sandboxStripe } from "@/lib/auntpenny/paid";
import { findActiveAuntPennyOrder, matchesCompletedCheckout } from "@/lib/auntpenny/fulfillment";
import { auntPennyPdf } from "@/lib/auntpenny/pdf";
import type { IntakeAnswers } from "@/lib/auntpenny/roast-engine";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
 try{
  requireSandbox();
  const token=request.nextUrl.searchParams.get("access_token");
  const sessionId=request.nextUrl.searchParams.get("session_id");
  const hasToken=!!token&&/^[A-Za-z0-9_-]{43}$/.test(token);
  const hasSession=!!sessionId&&/^cs_(test_|live_)[a-zA-Z0-9_]+$/.test(sessionId)&&sessionId.length<=255;
  if(!hasToken&&!hasSession)return new NextResponse("Missing report credential",{status:401});
  const recovered=hasToken?await findActiveAuntPennyOrder(token!):null;
  if(hasToken&&!recovered)return new NextResponse("Report link expired. Request a fresh link.",{status:401});
  const lookupId=recovered?.stripeSessionId??sessionId;
  if(!lookupId)return new NextResponse("Report unavailable",{status:401});
  const order=await prisma.auntPennyOrder.findUnique({where:{stripeSessionId:lookupId}});
  if(!order||order.status!=="PAID")return new NextResponse("Payment confirmation required",{status:403});
  if(hasToken&&(recovered?.id!==order.id||recovered.accessTokenHash!==order.accessTokenHash))return new NextResponse("Invalid report link",{status:403});
  const checkout=await sandboxStripe().checkout.sessions.retrieve(lookupId);
  if(!matchesCompletedCheckout(checkout,order))return new NextResponse("Payment confirmation required",{status:403});
  const pdf=auntPennyPdf(JSON.parse(order.intakeJson) as IntakeAnswers);
  return new NextResponse(Buffer.from(pdf),{status:200,headers:{"Content-Type":"application/pdf","Content-Disposition":'attachment; filename="Aunt-Penny-Private-Roast.pdf"',"Cache-Control":"private, no-store, max-age=0","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'"}});
 }catch{console.error("Aunt Penny PDF delivery failed");return new NextResponse("Report temporarily unavailable. Use your recovery link.",{status:503});}
}
