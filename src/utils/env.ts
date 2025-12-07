import z from "zod";

const StringToNumberSchema = z.string().transform((val) => {
  const parsed = parseInt(val);
  if (isNaN(parsed)) throw new Error(`Failed to parse ${val}. Not a number`);
  return parsed;
});

const envSchema = z.object({
  NODE_DEVELOPMENT: z
    .enum(["development", "testing", "production"])
    .default("development"),
  LOG_LEVEL: z
    .enum(["error", "warn", "info", "http", "verbose", "debug", "silly"])
    .default("silly"),
  SESSION_PARTICIPANT_DISCONNECTION_MAXIMUM_SECONDS:
    StringToNumberSchema.default(5 * 60),
  POSTGRES_HOST: z.string(),
  POSTGRES_PORT: StringToNumberSchema,
  POSTGRES_USER: z.string(),
  POSTGRES_PASSWORD: z.string(),
  POSTGRES_DB: z.string(),
  PORT: StringToNumberSchema,
});

const env = Object.freeze(envSchema.parse(process.env));

export default env;
