import { defineConfig } from "drizzle-kit";
import { connection_url } from "./src/db";

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schemas",
  dialect: "postgresql",
  dbCredentials: {
    url: connection_url,
  },
});
