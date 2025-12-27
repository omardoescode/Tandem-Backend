import { betterAuth } from "better-auth";
import { openAPI } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import * as authSchemas from "@/db/schemas/auth";

import env from "@/utils/env";

const auth = betterAuth({
  trustedOrigins: [env.BETTER_AUTH_TRUSTED_ORIGINS],

  emailAndPassword: {
    enabled: true,
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchemas,
  }),
  plugins: [openAPI()],
  user: {},
});

export default auth;
