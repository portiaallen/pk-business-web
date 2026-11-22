import { prisma } from "@/lib/prisma";
import { sendAuntPennyLink } from "@/lib/auntpenny/email";
import {
  issueToken, PRICE_CENTS, PRODUCT_CODE, publicOrigin, tokenHash, TOKEN_TTL_MS,
  type CheckoutSession,
} from "@/lib/auntpenny/paid";

type Order = {
  id: string;
  email: string;
  stripeSessionId: string | null;
  amountCents: number;
  status: string;
  accessTokenHash: string | null;
  accessExpiresAt: Date | null;
};

export function matchesCompletedCheckout(session: CheckoutSession, order: Order) {
  const fullyDiscounted = session.amount_total === 0 && session.total_details?.amount_discount === PRICE_CENTS;
  return session.status === "complete" &&
    (session.payment_status === "paid" || (fullyDiscounted && session.payment_status === "no_payment_required")) &&
    session.mode === "payment" && session.currency === "usd" &&
    (session.amount_total === PRICE_CENTS || fullyDiscounted) &&
    session.metadata?.productCode === PRODUCT_CODE && session.metadata.orderId === order.id &&
    session.client_reference_id === order.id && session.id === order.stripeSessionId &&
    order.amountCents === PRICE_CENTS && session.customer_details?.email?.trim().toLowerCase() === order.email;
}

export function findActiveAuntPennyOrder(token: string) {
  return prisma.auntPennyOrder.findFirst({
    where: { accessTokenHash: tokenHash(token), accessExpiresAt: { gt: new Date() }, status: "PAID" },
  });
}

export async function recordAuntPennyPayment(order: Order) {
  if (order.status === "PAID") return true;
  if (order.status !== "PENDING") return false;

  const transition = await prisma.auntPennyOrder.updateMany({
    where: { id: order.id, status: "PENDING" },
    data: { status: "PAID", paidAt: new Date() },
  });
  if (transition.count === 1) return true;

  const current = await prisma.auntPennyOrder.findUnique({
    where: { id: order.id },
    select: { status: true },
  });
  return current?.status === "PAID";
}

export async function emailAuntPennyReport(order: Order, delivery: "initial" | "recovery") {
  const now = new Date();
  const token = issueToken();
  const hash = tokenHash(token);
  const link = new URL("/auntpenny/roastmybooks/paid", publicOrigin());
  link.searchParams.set("access_token", token);
  const claim = await prisma.auntPennyOrder.updateMany({
    where: {
      id: order.id,
      status: "PAID",
      ...(delivery === "initial"
        ? { OR: [{ accessTokenHash: null }, { accessExpiresAt: null }, { accessExpiresAt: { lte: now } }] }
        : { accessTokenHash: order.accessTokenHash, accessExpiresAt: order.accessExpiresAt }),
    },
    data: { accessTokenHash: hash, accessExpiresAt: new Date(now.getTime() + TOKEN_TTL_MS) },
  });
  if (claim.count !== 1) return;

  try {
    await sendAuntPennyLink(order.email, link.href);
  } catch (error) {
    await prisma.auntPennyOrder.updateMany({
      where: { id: order.id, accessTokenHash: hash },
      data: {
        accessTokenHash: delivery === "recovery" ? order.accessTokenHash : null,
        accessExpiresAt: delivery === "recovery" ? order.accessExpiresAt : null,
      },
    });
    throw error;
  }
}
