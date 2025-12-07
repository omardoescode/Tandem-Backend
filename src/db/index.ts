import env from "@/utils/env";
import { drizzle } from "drizzle-orm/node-postgres";

export const connection_url = `postgres://${env.POSTGRES_USER}:${env.POSTGRES_PASSWORD}@${env.POSTGRES_HOST}:${env.POSTGRES_PORT}/${env.POSTGRES_DB}`;

export const db = drizzle(connection_url);
