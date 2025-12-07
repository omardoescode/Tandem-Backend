import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  interval,
  primaryKey,
  pgEnum,
  bigint,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { sessionStates } from "@/modules/session/entities/Session";
import { sessionParticipantStates } from "@/modules/session/entities/SessionParticipant";

export const SessionStateEnum = pgEnum("session_state", sessionStates);

export const TandemSessionTable = pgTable("tandem_session", {
  sessionId: uuid("session_id")
    .default(sql`uuidv7()`)
    .primaryKey(),
  state: SessionStateEnum().notNull(),
  startTime: timestamp("start_time", { withTimezone: true })
    .defaultNow()
    .notNull(),
  scheduledDuration: interval("scheduled_duration").notNull(),
});

export const SessionParticipantState = pgEnum(
  "participant_state",
  sessionParticipantStates,
);

export const SessionParticipantTable = pgTable(
  "session_participant",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => TandemSessionTable.sessionId, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    state: SessionParticipantState().notNull(),

    focusTimeSeconds: bigint("focus_time_seconds", { mode: "number" })
      .notNull()
      .default(0),
    breakTimeSeconds: bigint("break_time_seconds", { mode: "number" })
      .notNull()
      .default(0),

    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.sessionId, table.userId] })],
);

export const SessionTaskTable = pgTable("session_task", {
  taskId: uuid("task_id")
    .default(sql`uuidv7()`)
    .primaryKey(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => TandemSessionTable.sessionId, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),

  title: varchar("title", { length: 500 }).notNull(),
  isComplete: boolean("is_complete").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const CheckinReportTable = pgTable("checkin_report", {
  reportId: uuid("report_id")
    .default(sql`uuidv7()`)
    .primaryKey(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => TandemSessionTable.sessionId, { onDelete: "cascade" }),
  reviewerId: text("reviewer_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  revieweeId: text("reviewee_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  workProved: boolean("work_proved").notNull(),
});

export const CheckinMessageTable = pgTable("checkin_message", {
  messageId: uuid("messageId")
    .default(sql`uuidv7()`)
    .primaryKey(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => TandemSessionTable.sessionId, { onDelete: "cascade" }),
  content: text("content"),
  imageUrl: text("image_url"),
  audioUrl: text("audio_url"),
  orderingSeq: integer("ordering_seq").notNull(),
});
