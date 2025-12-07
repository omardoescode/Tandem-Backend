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
    last_ordering: z.number().int().positive().optional().default(0),
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
    type: z.literal("start_session"),
    partners: {
      id: z.string().nonempty(),
      tasks: z.array(z.string().nonempty()).min(1),
    },
    tasks: z.array(
      z.object({
        title: z.string().nonempty(),
        task_id: z.string().nonempty(),
      }),
    ),
    start_time: z.iso.date(),
    scheduled_duration: DurationSchema,
  }),
  z.object({
    type: z.literal("checkin_start"),
  }),
  z.object({
    type: z.literal("checkin_report_sent"),
    work_proved: z.boolean(),
  }),
  z.object({
    type: z.literal("checkin_partner_message"),
    content: z.string().nonempty(),
    from: z.string().nonempty(),
  }),
  z.object({
    type: z.literal("disconnected_permanantly"),
    partner_id: z.string().nonempty(),
  }),
  z.object({
    type: z.literal("session_done"),
  }),
  z.object({
    type: z.literal("session_data"),
    session_status: z.union([z.literal("checkin"), z.literal("running")]),
    time_left: DurationSchema.optional(),
    partners: {
      id: z.string().nonempty(),
      tasks: z.array(z.string().nonempty()).min(1),
    },
    tasks: z.array(
      z.object({
        title: z.string().nonempty(),
        task_id: z.string().nonempty(),
      }),
    ),
    start_time: z.iso.date(),
    scheduled_end_time: z.iso.date(),
  }),
  z.object({ type: z.literal("already_in_session") }),
]);

export type SessionWsResponse = z.infer<typeof SessionWSResponseSchema>;
