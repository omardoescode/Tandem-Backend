import { Entity } from "@/utils/Entity";

export interface UserData {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class User extends Entity<UserData> {}
