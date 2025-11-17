import z from "zod";

export const SessionWSMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("init_session"),
    tasks: z.array(z.string().nonempty()).min(1),
    focus_duration_seconds: z.number().int().min(1),
  }),
]);

export type SessionWsMessage = z.infer<typeof SessionWSMessageSchema>;

export const SessionWSResponseSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("error"),
    error: z.string(),
  }),
  z.object({
    type: z.literal("terminated"),
    reason: z.string().optional(),
  }),
  z.object({
    type: z.literal("matching_pending"),
  }),
  z.object({
    type: z.literal("other_used_disconnected"),
  }),
  z.object({
    type: z.literal("matched"),
    partner_id: z.string().nonempty(),
    partner_tasks: z.array(z.string().nonempty()).min(1),
  }),
]);

export type SessionWsResponse = z.infer<typeof SessionWSResponseSchema>;
