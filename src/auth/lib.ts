import { betterAuth } from "better-auth";
import { openAPI } from "better-auth/plugins";
import db from "@/db";

const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
  },
  database: db,
  trustedOrigins: ["http://localhost:5000"],
  plugins: [openAPI()],
});

export default auth;
