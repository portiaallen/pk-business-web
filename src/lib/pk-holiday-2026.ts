/** PK 2026 Founder-approved holiday campaign rules.
 * Pure rules only; payment eligibility and one-use redemption MUST be enforced
 * by durable server-side purchase/credit records, never this module alone.
 */
export const PK_HOLIDAY_2026 = Object.freeze({
  name:"Aunt Penny Black Friday / Cyber Monday 2026",
  auntPennyRegularCents:999,
  auntPennyHolidayCents:699,
  readinessRegularCents:9900,
  readinessCreditCents:1000,
  readinessCreditPriceCents:8900,
  holidayStartsAt:"2026-11-27T06:00:00.000Z",
  holidayEndsAt:"2026-12-01T06:00:00.000Z",
  creditStartsAt:"2026-12-01T06:00:00.000Z",
  creditEndsAt:"2027-01-01T06:00:00.000Z",
  holidayCode:"PENNYBF30",
  noStacking:true,
  qualifyingPaidOrdersOnly:true,
  qaOrdersExcluded:true,
});
export function isHolidayPurchaseWindow(date:Date){
 const t=date.getTime();
 return Number.isFinite(t)&&t>=Date.parse(PK_HOLIDAY_2026.holidayStartsAt)&&t<Date.parse(PK_HOLIDAY_2026.holidayEndsAt);
}
export function isCreditRedemptionWindow(date:Date){
 const t=date.getTime();
 return Number.isFinite(t)&&t>=Date.parse(PK_HOLIDAY_2026.creditStartsAt)&&t<Date.parse(PK_HOLIDAY_2026.creditEndsAt);
}
export function isQualifyingHolidayPayment(order:{status:string;amountPaidCents:number;paidAt:Date|null;refunded?:boolean;disputed?:boolean}){
 return order.status==="PAID" && order.amountPaidCents>0 && !!order.paidAt && isHolidayPurchaseWindow(order.paidAt) && !order.refunded && !order.disputed;
}
