import { betterAuth } from "better-auth";
import { openAPI } from "better-auth/plugins";
import db from "@/db";

const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
  },
  database: db,
  plugins: [openAPI()],
});

export default auth;
