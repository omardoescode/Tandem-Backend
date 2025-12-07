import { db } from "@/db";
import { user } from "@/db/schemas/auth";
import { eq } from "drizzle-orm";
import { User } from "./User";

export interface IUserRepository {
  getByUserId(userId: string): Promise<User | null>;
}

export const UserRepository: IUserRepository = {
  async getByUserId(userId) {
    const result = await db.select().from(user).where(eq(user.id, userId));
    return result.length == 0 ? null : new User(result[0]!);
  },
};
