import z from "zod";

const PortSchema = z.string().transform((val) => {
  const parsed = parseInt(val);
  if (isNaN(parsed)) throw new Error("Failed to parse port. Not a number");
  return parsed;
});

const envSchema = z.object({
  NODE_DEVELOPMENT: z
    .enum(["development", "testing", "production"])
    .default("development"),
  POSTGRES_HOST: z.string(),
  POSTGRES_PORT: PortSchema,
  POSTGRES_USER: z.string(),
  POSTGRES_PASSWORD: z.string(),
  POSTGRES_DB: z.string(),
  PORT: PortSchema,
});

const env = Object.freeze(envSchema.parse(process.env));

export default env;
