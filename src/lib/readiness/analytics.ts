import { createHash } from "node:crypto";
import { ANALYTICS_EVENTS } from "./policy";
import type { Tx } from "./access";
export async function track(
  tx: Tx,
  event: (typeof ANALYTICS_EVENTS)[number],
  key: string,
) {
  await tx.readinessAnalyticsEvent.upsert({
    where: {
      dedupeKey: createHash("sha256")
        .update(`readiness:${event}:${key}`)
        .digest("hex"),
    },
    update: {},
    create: {
      event,
      dedupeKey: createHash("sha256")
        .update(`readiness:${event}:${key}`)
        .digest("hex"),
    },
  });
}
