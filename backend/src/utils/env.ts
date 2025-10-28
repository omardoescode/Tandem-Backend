import z from "zod";

const envSchema = z.object({
  NODE_DEVELOPMENT: z
    .enum(["development", "testing", "production"])
    .default("development"),
  POSTGRES_HOST: z.string(),
  POSTGRES_PORT: z.string().transform((val) => {
    const parsed = parseInt(val);
    if (isNaN(parsed)) throw new Error("Failed to parse port. Not a number");
    return parsed;
  }),
  POSTGRES_USER: z.string(),
  POSTGRES_PASSWORD: z.string(),
  POSTGRES_DB: z.string(),
});

const env = envSchema.parse(process.env);

export default env;
