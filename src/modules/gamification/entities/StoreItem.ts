import { Entity } from "@/utils/Entity";

export interface StoreItemState {
  itemId: string;
  name: string;
  description?: string;
  price: number;
}

export class StoreItem extends Entity<StoreItemState> {
  constructor(state: StoreItemState) {
    super(state);
  }
}
