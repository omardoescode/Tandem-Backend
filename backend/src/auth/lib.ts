import { betterAuth } from "better-auth";
import { openAPI } from "better-auth/plugins";

const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
  },
  plugins: [openAPI()],
});

export default auth;
