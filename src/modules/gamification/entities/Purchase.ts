import { Entity } from "@/utils/Entity";

export interface PurchaseState {
  purchaseId: string;
  itemId: string;
  userId: string;
  createdAt: Date;
}

export class Purchase extends Entity<PurchaseState> {
  constructor(state: PurchaseState) {
    super(state);
  }
}
