import { db } from "@/db";
import { PurchaseTable } from "@/db/schemas/gamification";
import { Purchase } from "../entities/Purchase";
import { eq, count } from "drizzle-orm";
import logger from "@/lib/logger";

export interface IPurchaseRepository {
  getById(purchaseId: string): Promise<Purchase | null>;
  save(...purchases: Purchase[]): Promise<void>;
  countByUser(userId: string): Promise<number>;
}

export const PurchaseRepository: IPurchaseRepository = {
  async getById(purchaseId) {
    const result = await db
      .select()
      .from(PurchaseTable)
      .where(eq(PurchaseTable.purchaseId, purchaseId));

    if (result.length === 0) return null;
    return new Purchase(result[0]!);
  },
  async save(...purchases) {
    await Promise.all(
      purchases.map(async (purchase) => {
        const purchaseId = purchase.get("purchaseId");
        if (!purchase.isDirty()) {
          logger.warn(
            `Purchase (purchaseId=${purchaseId}) is not dirty. Avoid call to DB`,
          );
          return;
        }
        const changes = purchase.getChanges();
        await db
          .insert(PurchaseTable)
          .values({
            ...purchase.getCommittedState(),
            ...purchase.getChanges(),
          })
          .onConflictDoUpdate({
            target: PurchaseTable.purchaseId,
            set: changes,
          });
        purchase.commit();
      }),
    );
  },
  async countByUser(userId) {
    const result = await db
      .select({ count: count() })
      .from(PurchaseTable)
      .where(eq(PurchaseTable.userId, userId));
    return result[0]?.count ?? 0;
  },
};
