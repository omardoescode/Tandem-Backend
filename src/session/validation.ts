import z from "zod";

const hhmmssRegex = /^([0-1]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;
export const DurationSchema = z
  .string()
  .regex(hhmmssRegex, "Invalid time format HH:MM:SS");

export type Duration = z.infer<typeof DurationSchema>;

export const SessionWSMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("init_session"),
    tasks: z.array(z.string().nonempty()).min(1),
    focus_duration: DurationSchema,
  }),
  z.object({
    type: z.literal("toggle_task"),
    task_id: z.string().nonempty(),
    is_complete: z.boolean(),
  }),
  z.object({
    type: z.literal("checkin_report"),
    work_proved: z.boolean(),
    reviewee_id: z.string().nonempty(),
  }),
  z.object({
    type: z.literal("checkin_message"),
    content: z.string().nonempty(),
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
    tasks: z.array(
      z.object({
        title: z.string().nonempty(),
        task_id: z.string().nonempty(),
      }),
    ),
    start_time: z.iso.date(),
    scheduled_end_time: z.iso.date(),
  }),
  z.object({
    type: z.literal("checkin_start"),
    start_time: z.iso.date(),
    scheduled_end_time: z.iso.date(),
  }),
  z.object({
    type: z.literal("checkin_report_sent"),
    work_proved: z.boolean(),
  }),
  z.object({
    type: z.literal("checkin_partner_message"),
    content: z.string().nonempty(),
  }),
  z.object({
    type: z.literal("session_done"),
  }),
]);

export type SessionWsResponse = z.infer<typeof SessionWSResponseSchema>;
