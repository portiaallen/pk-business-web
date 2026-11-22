import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { PK_HOLIDAY_2026, isHolidayPurchaseWindow, isCreditRedemptionWindow } from "@/lib/pk-holiday-2026";

const emailHash = (email: string) => createHash("sha256").update(email.trim().toLowerCase()).digest("hex");

/** Call only after independently verifying a Stripe session against its paid order.
 * This excludes $0 founder QA orders and does not trust buyer-supplied amounts.
 */
export async function issueHolidayCredit(input: {
 orderId:string; buyerEmail:string; paidAt:Date;
 verifiedStripeAmountCents:number; verifiedStripePaid:boolean;
}) {
 if (!input.verifiedStripePaid || input.verifiedStripeAmountCents !== PK_HOLIDAY_2026.auntPennyHolidayCents) return null;
 const order=await prisma.auntPennyOrder.findUnique({where:{id:input.orderId}});
 if (!order || order.status!=="PAID" || !order.paidAt ||
     order.email.trim().toLowerCase()!==input.buyerEmail.trim().toLowerCase() ||
     !isHolidayPurchaseWindow(order.paidAt)) return null;
 return prisma.pkHolidayCredit.upsert({
  where:{auntPennyOrderId:order.id},
  create:{
   auntPennyOrderId:order.id,buyerEmailHash:emailHash(order.email),
   startsAt:new Date(PK_HOLIDAY_2026.creditStartsAt),
   expiresAt:new Date(PK_HOLIDAY_2026.creditEndsAt),
  },
  update:{},
 });
}

/** A credit is claimable only when the purchaser's identity has already been verified.
 * Checkout must also enforce a single-use reservation and validate the Stripe amount.
 */
export async function findAvailableHolidayCredit(verifiedEmail:string,now=new Date()){
 if(!isCreditRedemptionWindow(now))return null;
 return prisma.pkHolidayCredit.findFirst({
  where:{buyerEmailHash:emailHash(verifiedEmail),status:"ISSUED",revokedAt:null,
   startsAt:{lte:now},expiresAt:{gt:now},readinessAssessmentId:null},
  orderBy:{createdAt:"asc"},
 });
}

/** Reserve one credit atomically for a Readiness purchase. This must only be
 * invoked after authenticated email verification, not a public email field.
 */
export async function reserveHolidayCredit(verifiedEmail:string,assessmentId:string,now=new Date()){
 if(!isCreditRedemptionWindow(now))return null;
 return prisma.$transaction(async tx=>{
  const credit=await tx.pkHolidayCredit.findFirst({
   where:{buyerEmailHash:emailHash(verifiedEmail),status:"ISSUED",revokedAt:null,
    startsAt:{lte:now},expiresAt:{gt:now},readinessAssessmentId:null},
   orderBy:{createdAt:"asc"},
  });
  if(!credit)return null;
  const claimed=await tx.pkHolidayCredit.updateMany({
   where:{id:credit.id,status:"ISSUED",readinessAssessmentId:null,revokedAt:null,
    startsAt:{lte:now},expiresAt:{gt:now}},
   data:{status:"RESERVED",readinessAssessmentId:assessmentId},
  });
  return claimed.count===1?credit:null;
 });
}
export async function releaseHolidayCredit(creditId:string,assessmentId:string){
 return prisma.pkHolidayCredit.updateMany({
  where:{id:creditId,status:"RESERVED",readinessAssessmentId:assessmentId},
  data:{status:"ISSUED",readinessAssessmentId:null},
 });
}
export async function redeemHolidayCredit(creditId:string,assessmentId:string){
 return prisma.pkHolidayCredit.updateMany({
  where:{id:creditId,status:"RESERVED",readinessAssessmentId:assessmentId,revokedAt:null},
  data:{status:"REDEEMED",redeemedAt:new Date()},
 });
}
