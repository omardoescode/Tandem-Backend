import { betterAuth } from "better-auth";
import { openAPI } from "better-auth/plugins";
import pool from "@/db/pool";

const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
  },
  database: pool,
  plugins: [openAPI()],
  user: {
    deleteUser: {
      enabled: true,
    },
  },
});

export default auth;
